require('ts-node').register({transpileOnly:true,project:'apps/api/tsconfig.json'});
require('reflect-metadata');
const {Test}=require('@nestjs/testing');
const {ConfigService}=require('@nestjs/config');
const {PrismaService}=require('../apps/api/src/prisma/prisma.service.ts');
const {AppModule}=require('../apps/api/src/app.module.ts');
async function main(){
  const module=await Test.createTestingModule({imports:[AppModule]})
    .overrideProvider(PrismaService).useValue({})
    .overrideProvider(ConfigService).useValue({get:(key)=>key==='JWT_SECRET'?'verification-only-not-real':undefined})
    .compile();
  console.log('PASS: seluruh modul Nest dapat dirangkai dengan dependency yang terdaftar (Prisma mock; tanpa koneksi database).');
  await module.close();
}
main().catch(e=>{console.error(e);process.exitCode=1});
