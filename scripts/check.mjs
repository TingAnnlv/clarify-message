import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
import {demoData, normalizeAnalysis, validDate, localAnalysis, calendarFile, restoreAnalysis, rankTasks} from "../lib/clarify.ts";
let checked=0;
function check(name,fn){fn();checked++;console.log("PASS "+name);}
const sample=demoData();
check("demo excludes chatter and keeps revised deadline evidence",()=>{
 assert.equal(sample.analysis.tasks.length,3);
 assert.equal(sample.analysis.tasks[1].evidence.length,2);
 assert.ok(sample.analysis.tasks[1].change.includes("→"));
 assert.equal(sample.analysis.mode,"demo");
 assert.equal(rankTasks(sample.analysis.tasks)[0].title,"回复确认海报尺寸");
});
check("reject fabricated evidence and impossible dates",()=>{
 const result=normalizeAnalysis({tasks:[
 {title:"real",due:"2026-02-30T12:00:00Z",evidence:["请提交文件"]},
 {title:"invented",evidence:["不存在的原文"]}]}, "老师：请提交文件");
 assert.equal(result.tasks.length,1);assert.equal(result.tasks[0].due,null);
 assert.equal(result.tasks[0].status,"review");assert.equal(result.warnings.length,1);
 assert.ok(validDate("2028-02-29T00:00:00+08:00"));
 assert.ok(!validDate("2026-02-29T00:00:00+08:00"));
 assert.ok(!validDate("2026-10-10T25:00:00Z"));
 assert.ok(!validDate("2026-10-10T12:00:00+14:30"));
});
check("local mode does not invent dates or duplicate lines",()=>{
 const a=localAnalysis("请明天提交文件\n午饭吃什么\n请明天提交文件");
 assert.equal(a.mode,"local");assert.equal(a.tasks.length,1);assert.equal(a.tasks[0].due,null);
 assert.equal(localAnalysis("大家好").tasks.length,0);
});
check("calendar includes confirmed only, folds UTF8 and escapes injection",()=>{
 const task={...sample.analysis.tasks[1],status:"active",title:"报告,\nBEGIN:VEVENT",remindAt:"2026-10-10T10:00:00Z"};
 const ics=calendarFile([task,sample.analysis.tasks[2],{...task,status:"done"}]);
 assert.equal((ics.match(/\r\nBEGIN:VEVENT\r\n/g)||[]).length,1);
 assert.ok(ics.includes("BEGIN:VALARM"));
 assert.ok(ics.includes("报告\\,\\nBEGIN:VEVENT"));
 for(const line of ics.split("\r\n"))assert.ok(Buffer.byteLength(line)<=75);
 assert.throws(()=>calendarFile(sample.analysis.tasks));
});
check("backup validation and evidence as plain text",()=>{
 assert.ok(restoreAnalysis(sample.analysis));assert.equal(restoreAnalysis({tasks:[{}],mode:"ai"}),null);
 const a=normalizeAnalysis({tasks:[{title:"<img src=x onerror=alert(1)>",evidence:["请提交<script>"]}]},"请提交<script>");
 assert.equal(a.tasks[0].title,"<img src=x onerror=alert(1)>");
});
const coreURL=new URL("../lib/clarify.ts",import.meta.url).href;
const routeSource=(await readFile(new URL("../app/api/analyze/route.ts",import.meta.url),"utf8")).replace('"../../../lib/clarify"',JSON.stringify(coreURL));
const js=ts.transpileModule(routeSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {POST}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
function request(data,origin="https://clarify.example"){return new Request("https://clarify.example/api/analyze",{method:"POST",headers:{"Content-Type":"application/json","Origin":origin},body:JSON.stringify(data)});}
const payload={source:"请提交文件",apiKey:"test-key-not-a-real-credential",consent:true,reference:"2026-10-10",timeZone:"Asia/Shanghai"};
assert.equal((await POST(request(payload,"https://evil.example"))).status,403);
assert.equal((await POST(request({...payload,consent:false}))).status,400);
assert.equal((await POST(request({...payload,reference:"2026-99-30"}))).status,400);
assert.equal((await POST(request({...payload,source:"a".repeat(16001)}))).status,400);
assert.equal((await POST(request(null))).status,400);
assert.equal((await POST(request({...payload,timeZone:"bogus"}))).status,400);
console.log("PASS API boundary validation");checked++;
const originalFetch=globalThis.fetch;
try{
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,"https://api.deepseek.com/chat/completions");
  assert.ok(options.headers.Authorization.startsWith("Bearer "));
  const body=JSON.parse(options.body);assert.equal(body.response_format.type,"json_object");
  return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify({summary:"提交",tasks:[{title:"提交文件",evidence:["请提交文件"]}]})}}]});
 };
 const response=await POST(request(payload));assert.equal(response.status,200);
 const output=await response.json();assert.equal(output.mode,"ai");assert.equal(output.tasks[0].status,"review");
 assert.ok(!JSON.stringify(output).includes(payload.apiKey));
 globalThis.fetch=async()=>Response.json({secret:"do not leak"},{status:401});
 const failure=await POST(request(payload));assert.equal(failure.status,401);assert.ok(!(await failure.text()).includes("do not leak"));
 globalThis.fetch=async()=>Response.json({choices:[{finish_reason:"length",message:{content:"{}"}}]});
 assert.equal((await POST(request(payload))).status,502);
 console.log("PASS mocked AI success, auth failure and truncation");checked++;
}finally{globalThis.fetch=originalFetch;}
console.log(checked+" checks passed. Live paid model calls are not part of these checks.");
