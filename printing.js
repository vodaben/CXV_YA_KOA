const Router = require('koa-router');
const router = new Router({ prefix: '/printing' });

const base64 = require('base-64');
const fs = require('fs');

const Printer = require('c15yo-printing')

var printer = new Printer();

// Search mDNS for IPP Printers on the local lan
router.get('/getPrinterList', ctx => {
	ctx.set('Content-Type', 'application/json')
	// ctx.body = JSON.stringify(mdnsList)
	ctx.body = printer.getPrinters();
})

// Query Printer: Get info
router.get('/getPrinter/:printer', (ctx, next) => {
	ctx.set('Content-Type', 'application/json')
	ctx.body = printer.getPrinter(base64.decode(ctx.params.printer))
})

// Query Printer: Get IPP attributes
router.get('/getPrinterAttributes/:printer', async (ctx, next) => {
	ctx.set('Content-Type', 'application/json')
	try{
		let result = await new Promise((resolve, reject) => {
			printer.getPrinterAttributes(base64.decode(ctx.params.printer), (err, result) => {
				if(err) reject(err)
				else resolve(result)
			})
		});
		ctx.body = {
			status: 'OK',
			data: result
		};
	}catch(e){
		ctx.body = {
			status: 'ERROR',
			error: e.message
		}
	}
})

// Query IPP Printer: Get job
router.get('/getPrinterJob/:printer/:job', async (ctx, next) => {
	ctx.set('Content-Type', 'application/json')
	try{
		let result = await new Promise((resolve, reject) => {
			printer.getJobAttributes(
				base64.decode(ctx.params.printer),  
				base64.decode(ctx.params.job),
				(err, data) => {
					if(err) reject(err)
					else resolve(data)
				})
		});
		ctx.body = {
			status: 'OK',
			job: result
		};
	} catch(e) {
		ctx.body = {
			status: 'ERROR',
			error: e.message
		}
	}
});


// Query IPP Printer: Get job attributes
router.get('/getPrinterJobAttributes/:printer', async (ctx, next) => {
	ctx.set('Content-Type', 'application/json')
	try{
		let result = await new Promise((resolve, reject) => {
			printer.getPrinterAttributes(base64.decode(ctx.params.printer), (err, result) => {
				if(err) reject(err)
				else resolve(result)
			})
		});
		let returnVal = {};
		let attributes = result['printer-attributes-tag']['job-creation-attributes-supported']
		attributes.forEach((attribute) => {
			if(attribute.endsWith('-col')) {
				if(Array.isArray(result['printer-attributes-tag'][attribute + '-supported'])) {
					returnVal[attribute] = {}
					result['printer-attributes-tag'][attribute + '-supported'].forEach((col) => {
						returnVal[attribute][col] = result['printer-attributes-tag'][col + '-supported']
					})
				} else {
					returnVal[attribute] = result['printer-attributes-tag'][attribute + '-supported']
				}
			} else {
				returnVal[attribute] = result['printer-attributes-tag'][attribute + '-supported']
			}
		})
		ctx.body = {
			status: 'OK',
			'job-attributes-tag': returnVal
		};
	}catch(e){
		ctx.body = {
			status: 'ERROR',
			error: e.message
		}
	}
})

// Query job status
// router.get('/getPrinterJobAttributes/:joburi', async (ctx, next) => {
// 	ctx.set('Content-Type', 'application/json')
// });

// Send Print Job
// Send Print Job and Immediately return job id
router.put('/printJPEG/:printer', async (ctx, next) => {
	ctx.set('Content-Type', 'application/json')
	let body = ctx.request.body
	if (body.files.image) {
		try{
			let result = await new Promise((resolve, reject) => {
				printer.printJPEG(
					base64.decode(ctx.params.printer), 
					fs.readFileSync(body.files.image.path),
					{
						"job-attributes-tag":{
							"sides": "one-sided",
							"print-quality": "draft",
							"print-content-optimize": "photo",
							"media-col": {
								"media-source": "photo"
							}
						},
					},
					(err, res) => {
						if(err) reject(err)
						else resolve(res)
					})
			});

			ctx.body = {
				status: 'OK',
				data: result,
				job: base64.encode(result['job-attributes-tag']['job-uri'])
			}
		}catch(e){
			ctx.body = {
				status: 'ERROR',
				data: e.message
			}
		}
	} else {
		ctx.status = 400
		ctx.body = 'Missing'
	}
})

// Send Print Job and Await Print Job to complete
router.put('/printJPEGSync/:printer', async (ctx, next) => {
	ctx.set('Content-Type', 'application/json')
	let body = ctx.request.body
	if (body.files.image) {
		try{
			let result = await new Promise((resolve, reject) => {
				printer.printJPEG(
					base64.decode(ctx.params.printer), 
					fs.readFileSync(body.files.image.path),
					{
						"job-attributes-tag":{
							"sides": "one-sided",
							"print-quality": "draft",
							"print-content-optimize": "photo",
							"media-col": {
								"media-source": "photo"
							}
						},
					},
					(err, res) => {
						if(err) {
							reject(err)
						} else {
							let returnVal = {
								job: res
							}

							var loop = setInterval(() => {
								printer.getJobAttributes(
									base64.decode(ctx.params.printer),  
									res['job-attributes-tag']['job-uri'],
									(err, data) => {
										if(data['job-attributes-tag']['job-state'] != "processing") {
											clearInterval(loop)
											returnVal.completion = data
											resolve(returnVal)
										}
									})
							}, 1000)
						}
					})
			});

			ctx.body = {
				status: 'OK',
				data: result
			}
		}catch(e){
			ctx.body = {
				status: 'ERROR',
				data: e.message
			}
		}
	} else {
		ctx.status = 400
		ctx.body = 'Missing'
	}
})

module.exports = router;
