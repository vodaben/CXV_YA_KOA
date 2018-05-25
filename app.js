const Koa = require('koa');
const koaBody = require('koa-body');
const Router = require('koa-router');

const app = new Koa();
const router = new Router();

const printing = require('./printing')

// response
// app.use(ctx => {
//   ctx.body = 'Hello Koa';
// });

router.get('/', (ctx, next) => {
	ctx.body = "Welcome to Chivas15YO KOA API"
})

app.use(koaBody({ multipart: true }))
app.use(router.routes());
app.use(router.allowedMethods());
app.use(printing.routes());
app.use(printing.allowedMethods());
app.listen(3000);