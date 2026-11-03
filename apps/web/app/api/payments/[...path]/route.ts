import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
export const dynamic='force-dynamic';
async function proxy(req:NextRequest,context:{params:Promise<{path:string[]}>}){
 const token=extractRequestToken(req);if(!token)return NextResponse.json({error:'Silakan masuk kembali.'},{status:401});
 const path=(await context.params).path.join('/');
 if(!['committee','committee/detail','proof'].includes(path))return NextResponse.json({error:'Tidak ditemukan.'},{status:404});
 const result=await nestFetchAsUser('/payments/'+path+req.nextUrl.search,token,{method:req.method,...(req.method==='POST'?{body:await req.text()}:{})});
 return NextResponse.json(result.body,{status:result.status,headers:{'Cache-Control':'private, no-store'}});
}
export const GET=proxy;export const POST=proxy;
