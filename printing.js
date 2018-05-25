const Router = require('koa-router');
const router = new Router({ prefix: '/printing' });

const mdns = require('mdns-js');
const _ = require('lodash');
const ipp = require('ipp');
const uuidv5 = require('uuid/v5');
const fs = require('fs');

const BreakException = {};

var browser = mdns.createBrowser();
var mdnsList = {};

browser.on('ready', () => browser.discover());
browser.on('update', (data) => {
	try{
		data.type.forEach((type) => {
			if(type.name == 'ipp' || type.name == 'ipps') {
				mdnsList[uuidv5(data.addresses[0], uuidv5.DNS)] = data;
				throw BreakException;
			}
		})
	}catch(e){ if(e !== BreakException) throw e }
});

// Search mDNS for IPP Printers on the local lan
router.get('/getPrinterList', ctx => {
	// ctx.contentType = 'application/json'
	ctx.set('Content-Type', 'application/json')
	// ctx.response.headers['Content-Type']
	// console.log(ctx.response.header)
	// ctx.response.header['Content-Type'] = 'application/json'
	ctx.body = JSON.stringify(mdnsList)
})

// Query IPP Printer: Get info
router.get('/getPrinter/:uuid', async (ctx, next) => {
	let printer = ipp.Printer("http://" + mdnsList[ctx.params.uuid].addresses[0] + ":631/ipp/printer");
	let result = await new Promise((resolve, reject) => {
		printer.execute("Get-Printer-Attributes", null, function(err, res){
			resolve(JSON.stringify(res))
		});
	})
	ctx.body = result;
})

// Query IPP Printer: Get job attributes
router.get('/getPrinterJobAttributes/:uuid', async (ctx, next) => {
	let printer = ipp.Printer("http://" + mdnsList[ctx.params.uuid].addresses[0] + ":631/ipp/printer");
	let result = await new Promise((resolve, reject) => {
		printer.execute("Get-Printer-Attributes", null, function(err, res){
			let result = {};
			let attributes = res['printer-attributes-tag']['job-creation-attributes-supported']
			attributes.forEach((attribute) => {
				if(attribute.endsWith('-col')) {
					if(Array.isArray(res['printer-attributes-tag'][attribute + '-supported'])) {
						result[attribute] = {}
						res['printer-attributes-tag'][attribute + '-supported'].forEach((col) => {
							result[attribute][col] = res['printer-attributes-tag'][col + '-supported']
						})
					} else {
						result[attribute] = res['printer-attributes-tag'][attribute + '-supported']
					}
				} else {
					result[attribute] = res['printer-attributes-tag'][attribute + '-supported']
				}
			})
			resolve(JSON.stringify(result))
		});
	})
	ctx.body = result;
})

// Send Print Job
router.put('/print/:uuid', async (ctx, next) => {
	let body = ctx.request.body
	console.log(body.files.image)
	if (body.files.image) {
		let msg = {
			"operation-attributes-tag": {
				"requesting-user-name": "Bumblebee",
				"job-name": "whatever.jpg",
				"document-format": body.files.image.path
			},
			"job-attributes-tag":{
				"media-col": {
					"media-source": "photo"
				}
			}
			, data: fs.readFileSync(body.files.image.path)
			// , data: new Buffer(body.files.image.path)
		};
		let printer = ipp.Printer("http://" + mdnsList[ctx.params.uuid].addresses[0] + ":631/ipp/printer");
		// printer.execute("Print-Job", msg, function(err, res){
			// console.log(err);
			// console.log(res);
		// });
		// Buffer.from(b64string, 'base64');
		ctx.body = 'OK'
	} else {
		ctx.status = 400
		ctx.body = 'Missing'
	}
})

module.exports = router;
