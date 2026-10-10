"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Bell, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, FileText, Inbox, LayoutDashboard, ListChecks, LoaderCircle, MessageSquare, Plus, Search, Settings2, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import { Analysis, Task, MAX_INPUT, calendarFile, demoData, localAnalysis, rankTasks, restoreAnalysis } from "../lib/clarify";

const KEY="clarify-message-v1";
const iso=(d:Date)=>d.toISOString().replace(/\.\d{3}Z$/,"Z");
function localValue(value:string|null){if(!value)return "";const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
const modeNames={demo:"示例结果 · 非实时 AI",local:"本地规则初筛",ai:"DeepSeek AI 分析"};
const priorityNames={high:"优先处理",medium:"按时完成",low:"稍后处理"};
function download(name:string,text:string,type:string){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function dateLabel(s:string|null){return s?new Date(s).toLocaleString("zh-CN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}):"时间待确认";}

export default function Home(){
 const [view,setView]=useState<"work"|"tasks"|"guide">("work");
 const [source,setSource]=useState("");const [reference,setReference]=useState("");const [zone,setZone]=useState("Asia/Shanghai");
 const [analysis,setAnalysis]=useState<Analysis|null>(null);const [ready,setReady]=useState(false);
 const [mode,setMode]=useState<"local"|"ai">("local");const [apiKey,setApiKey]=useState("");const [consent,setConsent]=useState(false);
 const [settings,setSettings]=useState(false);const [editing,setEditing]=useState<Task|null>(null);
 const [filter,setFilter]=useState("all");const [query,setQuery]=useState("");const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");const [storageError,setStorageError]=useState(false);
 const [permission,setPermission]=useState("default");
 const settingsDialog=useRef<HTMLDialogElement>(null);const editDialog=useRef<HTMLDialogElement>(null);const upload=useRef<HTMLInputElement>(null);
 const analyzeController=useRef<AbortController|null>(null);

 useEffect(()=>{
   setReference(localValue(new Date().toISOString()).slice(0,10));setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
   if("Notification" in window)setPermission(Notification.permission);
   try{
     const saved=localStorage.getItem(KEY);
     if(saved){const value=JSON.parse(saved);setSource(typeof value.source==="string"?value.source.slice(0,MAX_INPUT):"");const restored=restoreAnalysis(value.analysis);setAnalysis(restored);if(value.analysis&&!restored)setError("之前保存的数据无法读取，请重新分析。");}
   }catch{setStorageError(true);}
   setReady(true);return ()=>analyzeController.current?.abort();
 },[]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem(KEY,JSON.stringify({source,analysis}));}catch{setStorageError(true);}},[source,analysis,ready]);
 useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(""),6500);return ()=>clearTimeout(id);},[notice]);
 useEffect(()=>{if(settings)settingsDialog.current?.showModal();else settingsDialog.current?.close();},[settings]);
 useEffect(()=>{if(editing)editDialog.current?.showModal();else editDialog.current?.close();},[editing]);
 useEffect(()=>{
   if(!analysis)return;
   function tick(){
     const due=analysis!.tasks.filter(t=>t.status==="active"&&t.remindAt&&!t.notified&&Date.parse(t.remindAt)<=Date.now());
     if(!due.length)return;
     const ids=new Set(due.map(t=>t.id));
     setAnalysis(a=>a?{...a,tasks:a.tasks.map(t=>ids.has(t.id)?{...t,notified:true}:t)}:a);
     setNotice("到提醒时间了："+due.map(t=>t.title).join("、"));
     if("Notification" in window && Notification.permission==="granted"){
       for(const t of due)try{new Notification("Clarify Message",{body:t.title,tag:t.id,icon:"/favicon.svg"});}catch{}
     }
   }
   tick();const id=setInterval(tick,15000);document.addEventListener("visibilitychange",tick);
   return()=>{clearInterval(id);document.removeEventListener("visibilitychange",tick);};
 },[analysis]);

 const tasks=analysis?.tasks||[];
 const review=tasks.filter(t=>t.status==="review").length;const active=tasks.filter(t=>t.status==="active").length;const done=tasks.filter(t=>t.status==="done").length;
 const visible=rankTasks(tasks).filter(t=>(filter==="all"||t.status===filter)&&[t.title,t.owner,t.reason,...t.evidence].join(" ").toLowerCase().includes(query.toLowerCase()));
 const replaceOkay=()=>!tasks.length||window.confirm("这会替换当前这批行动项。需要保留时，请先导出备份。继续吗？");
 function showDemo(){if(busy||!replaceOkay())return;const d=demoData();setSource(d.source);setAnalysis(d.analysis);setView("work");setFilter("all");setError("");setNotice("已载入虚构工作场景和预置分析结果，可体验确认与提醒。");}
 async function run(){
   setError("");if(!source.trim()){setError("请先粘贴消息，或点击「体验完整示例」。");return;}
   if(source.length>MAX_INPUT){setError("消息超过 16000 字，请分批输入。");return;}
   if(mode==="ai" && (!apiKey || !consent)){setSettings(true);setError("AI 分析需要填写密钥，并同意发送这次消息。");return;}
   if(!replaceOkay())return;
   if(mode==="local"){setAnalysis(localAnalysis(source));setFilter("all");setNotice("初筛完成，请核对并确认行动项。");return;}
   setBusy(true);const controller=new AbortController();analyzeController.current=controller;
   const timeout=setTimeout(()=>controller.abort(),75000);
   try{
     const res=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source,apiKey,consent,reference,timeZone:zone}),signal:controller.signal});
     const data:any=await res.json();if(!res.ok)throw new Error(data.error||"分析失败，请重试。");
     const a=restoreAnalysis(data);if(!a)throw new Error("分析结果无法识别，请重试。");setAnalysis(a);setFilter("all");setNotice("AI 分析完成，请核对原文后确认。");
   }catch(e){setError(e instanceof Error&&e.name==="AbortError"?"分析已取消或超时，原有行动项仍然保留。":e instanceof Error?e.message:"网络异常，请重试。");}
   finally{clearTimeout(timeout);setBusy(false);analyzeController.current=null;}
 }
 function updateTask(id:string,patch:Partial<Task>){setAnalysis(a=>a?{...a,tasks:a.tasks.map(t=>t.id===id?{...t,...patch}:t)}:a);}
 async function notifications(){
   if(!("Notification" in window)){setNotice("此浏览器不支持桌面通知，请导出到日历提醒。");return;}
   try{const p=await Notification.requestPermission();setPermission(p);setNotice(p==="granted"?"桌面通知已开启；请保持页面打开，或导出到日历。":"未开启桌面通知。仍可使用页面内提示或日历。");}catch{setNotice("无法申请通知权限，请使用日历提醒。");}
 }
 function exportCalendar(){try{download("clarify-actions.ics",calendarFile(tasks),"text/calendar;charset=utf-8");setNotice("已导出日历文件。请导入日历并检查提醒；后续修改需重新导出。");}catch(e){setNotice((e as Error).message);}}
 function saveEdit(e:React.FormEvent<HTMLFormElement>){
   e.preventDefault();if(!editing)return;
   const f=new FormData(e.currentTarget);const due=String(f.get("due")||"");const remind=String(f.get("remind")||"");
   const title=String(f.get("title")||"").trim();if(!title){setNotice("请填写事项名称。");return;}
   updateTask(editing.id,{title,owner:String(f.get("owner")||"我"),priority:f.get("priority") as Task["priority"],due:due?iso(new Date(due)):null,remindAt:remind?iso(new Date(remind)):null,status:"active",notified:false,uncertainty:""});
   setEditing(null);setNotice("已确认行动项"+(remind?"，提醒时间已保存。":"。可随时编辑提醒时间。"));
 }
 async function importText(file?:File){if(!file)return;if(file.size>90000){setError("文件过大，请选择较短的 UTF-8 文本文件。");return;}try{const text=await file.text();if(text.length>MAX_INPUT)throw new Error("文本超过 16000 字，请分批输入。");setSource(text);setError("");setNotice("文本已导入，点击分析即可整理。");}catch(e){setError((e as Error).message);}}
 const Icon=view==="work"?LayoutDashboard:view==="tasks"?ListChecks:CircleHelp;

 return <div className="shell">
  <aside className="sidebar">
   <a className="brand" href="/" aria-label="Clarify Message 首页"><span className="brand-symbol"><MessageSquare size={23}/><span/></span><span>clarify<span className="brand-sub">message</span></span></a>
   <div className="workspace-label">个人工作空间</div>
   <nav aria-label="主导航">
    <button className={view==="work"?"nav-item selected":"nav-item"} onClick={()=>setView("work")}><LayoutDashboard size={18}/> 消息工作台</button>
    <button className={view==="tasks"?"nav-item selected":"nav-item"} onClick={()=>setView("tasks")}><ListChecks size={18}/> 行动清单 <span className="nav-count">{active+review}</span></button>
    <button className={view==="guide"?"nav-item selected":"nav-item"} onClick={()=>setView("guide")}><CircleHelp size={18}/> 使用指南</button>
   </nav>
   <div className="sidebar-note"><div className="orbit"><MessageSquare size={25}/><Check size={15}/></div><strong>少翻消息，多做要事。</strong><p>每个行动建议，<br/>都有原文可循。</p><button onClick={showDemo} disabled={busy||!ready}>体验完整示例 <ArrowUpRight size={15}/></button></div>
   <div className="sidebar-bottom"><button className="nav-item" onClick={()=>setSettings(true)}><Settings2 size={18}/> 分析与提醒设置</button><a href="https://github.com/TingAnnlv/clarify-message" target="_blank" rel="noreferrer">项目源码 <ArrowUpRight size={14}/></a><div className="profile"><span>你</span><div>我的工作空间<small>数据保存在当前浏览器</small></div></div></div>
  </aside>
  <div className="main-shell">
   <header className="topbar"><div className="breadcrumb"><Icon size={16}/><span>我的工作空间</span><ChevronRight size={14}/><strong>{view==="work"?"消息工作台":view==="tasks"?"行动清单":"使用指南"}</strong></div><div className="top-actions"><span className="save-status"><i/> {storageError?"仅本次会话":"本地保存"}</span><button className="icon-btn" title="提醒设置" aria-label="提醒设置" onClick={()=>setSettings(true)}><Bell size={18}/></button><span className="avatar">你</span></div></header>
   <main>
    <section className="page-heading"><div><p className="welcome">给忙碌的你，一点清晰。</p><h1>{view==="work"?"让重要的事，浮出消息。":view==="tasks"?"接下来，专注行动。":"从消息到行动，简单三步。"}</h1><p>{view==="work"?"整理工作消息、识别截止日期，用看得见的依据决定先做什么。":view==="tasks"?"核对、确认、完成。把注意力留给真正需要你处理的事。":"先体验，再导入你的消息。所有建议都由你最后确认。"}</p></div><button className="secondary heading-btn" onClick={showDemo} disabled={busy||!ready}><Sparkles size={16}/> 体验完整示例</button></section>
    {storageError&&<p className="alert" role="alert">浏览器存储不可用，刷新后可能丢失数据。请导出备份。</p>}
    {view==="guide"?<section className="guide">
      <article><span className="step">1</span><h2>把消息放进来</h2><p>粘贴一段带发送时间和发送人的消息，或导入 UTF-8 .txt 文件。微信、QQ 需要手动复制；本站不会自动读取群聊。</p></article>
      <article><span className="step">2</span><h2>看清该做什么</h2><p>本地初筛用关键词找出候选消息；AI 分析会结合上下文整理事项、改期和等待关系。展开「原文依据」检查判断。</p></article>
      <article><span className="step">3</span><h2>确认并安排提醒</h2><p>点击「核对并确认」，检查负责人、截止时间和提醒时间。网页提醒需要页面保持打开；关闭网页时，使用导出的日历提醒。</p></article>
      <div className="guide-wide"><ShieldCheck size={23}/><div><h2>你的消息，由你决定怎么用</h2><p>输入和行动项保存在当前浏览器，不会跨设备同步。本地初筛不上传消息。AI 模式仅在你同意并点击分析后，将输入和临时密钥经本站服务转发到 DeepSeek；密钥不写入浏览器存储。第三方服务的数据处理适用其政策。</p><p>示例使用虚构人物和预置结果，并非真实 AI 调用。首次打开可以直接体验全部交互；实际 AI 分析需自备 DeepSeek API Key，费用由该账户承担。</p></div></div>
      <button className="primary" onClick={()=>setView("work")}>开始整理消息 <ChevronRight size={17}/></button>
    </section>:<>
    <section className="stats" aria-label="行动概览">
      <div><span className="stat-icon blue"><Inbox size={20}/></span><div><p>待你核对</p><strong>{review}<small>项</small></strong></div></div>
      <div><span className="stat-icon amber"><Clock3 size={20}/></span><div><p>正在进行</p><strong>{active}<small>项</small></strong></div></div>
      <div><span className="stat-icon green"><CheckCheck size={20}/></span><div><p>已完成</p><strong>{done}<small>项</small></strong></div></div>
      <div className="stats-caption"><ShieldCheck size={20}/><p>先核对，再行动<small>不会自动发送消息或执行任务</small></p></div>
    </section>
    <div className={view==="tasks"?"workspace tasks-only":"workspace"}>
     {view==="work"&&<section className="input-panel panel">
      <div className="panel-heading"><h2><MessageSquare size={19}/> 消息收件箱</h2><button className="text-btn" disabled={busy||!ready} onClick={()=>upload.current?.click()}><Upload size={14}/> 导入文本</button></div>
      <p className="panel-description">把分散的工作消息，放在一起看。</p>
      <div className="input-label"><label htmlFor="messages">原始消息</label><button className="text-btn muted" disabled={busy||!ready} onClick={()=>setSource("")}>清空输入</button></div>
      <textarea id="messages" value={source} onChange={e=>setSource(e.target.value)} disabled={busy||!ready} maxLength={MAX_INPUT} placeholder={"粘贴聊天记录、邮件或工作通知…\n\n例如：\n10 月 10 日 09:30 客户：初稿请周五交。\n10 月 10 日 10:00 客户：会议提前了，改成周四中午。\n同事：先确认尺寸，我才能开始排版。"} />
      <div className="input-foot"><span>保留日期和上下文，结果会更准确</span><span>{source.length.toLocaleString()} / 16,000</span></div>
      <div className="reference"><label>参考日期<input type="date" value={reference} onChange={e=>setReference(e.target.value)} disabled={busy||!ready}/></label><div><span>显示时区</span><strong>{zone}</strong></div></div>
      <div className="mode-switch" aria-label="分析方式"><button aria-pressed={mode==="local"} className={mode==="local"?"on":""} onClick={()=>setMode("local")} disabled={busy||!ready}>本地初筛 <span>无需密钥</span></button><button aria-pressed={mode==="ai"} className={mode==="ai"?"on":""} onClick={()=>setMode("ai")} disabled={busy||!ready}><Sparkles size={14}/> AI 分析</button></div>
      <p className="mode-hint">{mode==="local"?"用关键词识别候选行动，不推断日期或改期。":"理解上下文、识别改期和依赖。消息将发送给 DeepSeek。"}{mode==="ai"&&<button className="text-btn" onClick={()=>setSettings(true)}>设置密钥</button>}</p>
      <button className="primary analyze-btn" onClick={run} disabled={busy||!ready}>{busy?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>} {busy?"正在梳理消息…":mode==="ai"?"分析并生成行动建议":"整理候选行动"} {!busy&&<ChevronRight size={18}/>}</button>
      {busy&&<button className="text-btn cancel" onClick={()=>analyzeController.current?.abort()}>取消分析</button>}
      {error&&<p className="error" role="alert">{error}</p>}
      <div className="privacy-line"><ShieldCheck size={13}/><span>{mode==="local"?"本地模式下，消息不会发送到服务器。":"密钥仅在本次打开页面期间使用。"}</span></div>
      <input ref={upload} type="file" accept=".txt,text/plain" hidden onChange={e=>{importText(e.target.files?.[0]);e.target.value="";}}/>
     </section>}
     <section className="results" aria-label="行动建议">
       <div className="results-heading"><div><h2>你的行动建议 <span>{tasks.length}</span></h2><p>{analysis?modeNames[analysis.mode]:"从杂乱的信息中，找到下一步。"}</p></div><button className="secondary compact" onClick={exportCalendar}><ArrowDownToLine size={15}/> 导出日历</button></div>
       {analysis&&<div className="summary"><span className="summary-mark"><Sparkles size={18}/></span><div><strong>{analysis.mode==="demo"?"示例中的处理建议":"建议从这里开始"}</strong><p>{analysis.summary}</p></div></div>}
       <div className="result-tools"><div className="tabs">{[["all","全部"],["review","待核对"],["active","进行中"],["done","已完成"]].map(([v,n])=><button key={v} className={filter===v?"active":""} onClick={()=>setFilter(v)}>{n}</button>)}</div><label className="search"><Search size={15}/><input aria-label="搜索行动" placeholder="搜索" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
       {!tasks.length?<div className="empty"><div className="empty-illustration"><div className="paper back"/><div className="paper"><span/><span/><span/><i><Check size={22}/></i></div><span className="little-star">✦</span></div><h3>{analysis?"暂时没有找到行动项":"重要的事，会在这里变清晰。"}</h3><p>{analysis?"试试补充上下文，或切换到 AI 分析。":"粘贴消息开始整理，或者先用一组工作消息体验完整流程。"}</p><button className="secondary" onClick={showDemo} disabled={busy||!ready}><Sparkles size={16}/> 试试工作消息示例</button><div className="empty-features"><span><Check size={13}/> 原文可追溯</span><span><Check size={13}/> 时间可修改</span><span><Check size={13}/> 行动可提醒</span></div></div>:<div className="task-list">
         {!visible.length&&<div className="small-empty">没有符合条件的行动项。试试其他筛选条件。</div>}
         {visible.map(t=><article className={"task-card "+(t.status==="done"?"completed":"")} key={t.id}>
           <div className="task-top"><span className={"priority "+t.priority}><i/>{priorityNames[t.priority]}</span><span className="task-state">{t.status==="review"?"待你核对":t.status==="done"?"已完成":"进行中"}</span></div>
           <h3>{t.title}</h3><div className="task-meta"><span><Clock3 size={14}/>{dateLabel(t.due)}{t.due&&Date.parse(t.due)<Date.now()&&t.status!=="done"&&<b>已过期</b>}</span><span className="owner">{t.owner}</span></div>
           {t.change&&<div className="change"><span>截止时间有更新</span><p>{t.change}</p></div>}
           <p className="reason">{t.reason}</p>
           {t.uncertainty&&<p className="uncertainty"><CircleHelp size={14}/>{t.uncertainty}</p>}
           <details className="evidence"><summary><FileText size={14}/> 原文依据 <span>{t.evidence.length} 条</span><ChevronRight size={14}/></summary><div>{t.evidence.map((q,i)=><blockquote key={i}>{q}</blockquote>)}</div></details>
           {t.status==="active"&&t.remindAt&&<p className="remind-line"><Bell size={13}/>{t.notified?"已提醒，可稍后再提醒":"提醒："+dateLabel(t.remindAt)}</p>}
           <div className="task-actions">{t.status==="review"?<><button className="secondary compact" onClick={()=>setEditing(t)}><Check size={14}/> 核对并确认</button><button className="text-btn muted" onClick={()=>{if(window.confirm("移除这条候选行动？"))setAnalysis(a=>a?{...a,tasks:a.tasks.filter(x=>x.id!==t.id)}:a);}}>忽略</button></>:t.status==="active"?<><button className="complete-btn" onClick={()=>{updateTask(t.id,{status:"done"});setNotice("已完成："+t.title);}}><Check size={14}/> 标记完成</button><button className="text-btn" onClick={()=>setEditing(t)}>编辑</button><button className="text-btn muted" onClick={()=>{updateTask(t.id,{remindAt:iso(new Date(Date.now()+10*60000)),notified:false});setNotice("已设为 10 分钟后提醒。");}}>10 分钟后提醒</button></>:<><span className="done-label"><CheckCheck size={16}/> 做得好，又完成一件事。</span><button className="text-btn" onClick={()=>updateTask(t.id,{status:"active",remindAt:null,notified:false})}>重新打开</button></>}</div>
         </article>)}
       </div>}
       {analysis?.warnings.map((w,i)=><p className="result-note" key={i}><CircleHelp size={14}/>{w}</p>)}
     </section>
    </div>
    <footer><span><ShieldCheck size={14}/> 数据仅保存在当前浏览器</span><span>网页提醒需保持页面打开 · 关闭后请使用日历提醒</span></footer>
    </>}
   </main>
  </div>
  <div className="toast" role="status" aria-live="polite" hidden={!notice}><Check size={17}/><span>{notice}</span><button className="icon-btn" aria-label="关闭提示" onClick={()=>setNotice("")}><X size={15}/></button></div>
  <dialog ref={settingsDialog} onCancel={()=>setSettings(false)} onClick={e=>{if(e.target===e.currentTarget)setSettings(false);}} className="modal">
   <div className="modal-header"><h2>分析与提醒设置</h2><button className="icon-btn" onClick={()=>setSettings(false)} aria-label="关闭设置"><X size={20}/></button></div>
   <p>默认可使用本地初筛。连接 AI 后，可以整理改期和等待关系。</p>
   <label className="field">DeepSeek API Key<input type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value.trim())} placeholder="仅在本次打开页面期间使用"/></label>
   <p className="field-help">密钥不会保存到浏览器或仓库。通过本站服务仅转发至 api.deepseek.com，费用由你的 DeepSeek 账户承担。<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer">获取密钥</a></p>
   <label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>我同意在点击 AI 分析后，将输入消息发送给 DeepSeek。请先去除不需要的私人信息。</span></label>
   <div className="settings-section"><h3>提醒方式</h3><p>桌面通知：{permission==="granted"?"已允许":permission==="denied"?"已被浏览器阻止，请在浏览器设置中开启":"尚未开启"}。网页关闭或电脑休眠时，网页提醒不会按时触发。</p><button className="secondary" onClick={notifications}><Bell size={16}/> 开启桌面通知</button><p className="field-help">需要在网页关闭后提醒？确认事项后导出日历，并在日历应用中检查提醒设置。</p></div>
   <div className="settings-section"><h3>本地数据</h3><div className="settings-buttons"><button className="secondary" onClick={()=>download("clarify-backup.json",JSON.stringify({source,analysis},null,2),"application/json")}>导出备份</button><label className="secondary file-label">恢复备份<input hidden type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>2000000){setNotice("备份文件过大。");return;}try{const raw=JSON.parse(await file.text());const a=restoreAnalysis(raw.analysis);if(raw.analysis&&!a)throw new Error();if(typeof raw.source!=="string"||raw.source.length>MAX_INPUT)throw new Error();if(!replaceOkay())return;setAnalysis(a);setSource(raw.source);setNotice("备份已恢复。");}catch{setNotice("备份格式无效，请选择本站导出的 JSON 文件。");}}}/></label><button className="text-btn danger" onClick={()=>{if(window.confirm("清除当前浏览器中的消息和行动项？此操作不能撤销。")){setSource("");setAnalysis(null);setNotice("本地数据已清除。");}}}>清除数据</button></div></div>
   <button className="primary modal-save" onClick={()=>{if(apiKey&&consent)setMode("ai");setSettings(false);setNotice("设置已更新。");}}>保存设置</button>
  </dialog>
  <dialog ref={editDialog} className="modal" onCancel={()=>setEditing(null)}>{editing&&<form key={editing.id} onSubmit={saveEdit}>
   <div className="modal-header"><h2>核对行动与时间</h2><button type="button" className="icon-btn" onClick={()=>setEditing(null)} aria-label="关闭编辑"><X size={20}/></button></div>
   <p>以原文为准，确认后才会启动提醒。时间使用 {zone}。</p>
   <label className="field">事项名称<input name="title" defaultValue={editing.title} required maxLength={120}/></label>
   <div className="form-row"><label className="field">负责人<input name="owner" defaultValue={editing.owner} maxLength={60}/></label><label className="field">优先级<select name="priority" defaultValue={editing.priority}><option value="high">优先处理</option><option value="medium">按时完成</option><option value="low">稍后处理</option></select></label></div>
   <label className="field">截止时间（不明确可留空）<input type="datetime-local" name="due" defaultValue={localValue(editing.due)}/></label>
   <label className="field">提醒时间（可独立设置）<input type="datetime-local" name="remind" defaultValue={localValue(editing.remindAt)}/></label>
   <p className="field-help">过去的提醒时间会在页面运行时立即提示；需要准时后台提醒，请导出日历。</p>
   <details className="evidence" open><summary>核对原文</summary>{editing.evidence.map((q,i)=><blockquote key={i}>{q}</blockquote>)}</details>
   <button className="primary modal-save" type="submit"><Check size={17}/> 保存并确认</button>
  </form>}</dialog>
 </div>;
}
