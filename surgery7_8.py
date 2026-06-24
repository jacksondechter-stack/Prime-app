#!/usr/bin/env python3
"""
Surgery 7+8: Date Navigator + Backfill

Lifts a viewDate state to MA, rewires td/setTd to use viewDate,
makes the week strip in TT interactive (tap a day chip → navigate to that day),
adds a rolling 7-day window (today is rightmost; no future days rendered),
adds grade letters on past chips, adds a "← Today" jump button when not viewing today.

All tabs (Today / Eat / Train / Drinks) auto-follow viewDate via the shared td prop.
Streak counter stays today-pinned (its loop already uses `today` directly).

5 patches, all in src/app/page.js.

Usage:
  python3 surgery7_8.py --dry-run   # validate only
  python3 surgery7_8.py             # apply changes

KNOWN LIMITATIONS (deferred to a polish surgery):
- Backfill edits to non-today logs may not trigger an immediate Turso save
  (the sL save scheduler only fires when today's log count changes).
  They DO persist to local state and will sync next time today is edited
  or app is reloaded.
- Streak flame icons on chips are not yet drawn (visual polish, not logic).
- Re-grading a backfilled past day requires manually re-running closeDay.
"""
import sys
from pathlib import Path

FILE = Path("src/app/page.js")
DRY_RUN = "--dry-run" in sys.argv


def patch(content, find, replace, label):
    count = content.count(find)
    if count != 1:
        print(f"FAIL {label}: expected 1 match, found {count}")
        anchor = find[:60]
        if anchor in content:
            idx = content.find(anchor)
            actual = content[idx:idx + len(find) + 30]
            print(f"  Anchor found at offset {idx}.")
            print(f"  ACTUAL (first 250 chars):")
            print(f"    {repr(actual[:250])}")
            print(f"  EXPECTED:")
            print(f"    {repr(find[:250])}")
            for i, (a, b) in enumerate(zip(actual, find)):
                if a != b:
                    print(f"  First diff at char {i}: "
                          f"actual={repr(a)} (U+{ord(a):04X}) vs "
                          f"expected={repr(b)} (U+{ord(b):04X})")
                    break
        else:
            print(f"  Anchor not found anywhere. First 40 chars of search:")
            print(f"    {repr(anchor[:40])}")
        sys.exit(1)
    print(f"OK   {label}")
    return content.replace(find, replace)


if not FILE.exists():
    print(f"FATAL: {FILE} not found. Run from project root.")
    sys.exit(1)

ORIGINAL = FILE.read_text()
content = ORIGINAL

print(f"Target: {FILE}  ({len(ORIGINAL)} bytes)")
print(f"Mode:   {'DRY RUN (no write)' if DRY_RUN else 'WRITE'}\n")


# 7a: Lift viewDate state to MA, rewire td and setTd
content = patch(content,
    'const today=ds();const td=logs[today]||{};const setTd=useCallback(fn=>sL(p=>{const c=p[today]||{};return{...p,[today]:typeof fn==="function"?fn(c):fn};}),[today,sL]);',
    'const today=ds();const[viewDate,setViewDateRaw]=useState(today);const setViewDate=useCallback(d=>{if(d&&d<=today)setViewDateRaw(d);},[today]);const td=logs[viewDate]||{};const setTd=useCallback(fn=>sL(p=>{const c=p[viewDate]||{};return{...p,[viewDate]:typeof fn==="function"?fn(c):fn};}),[viewDate,sL]);',
    '7a: lift viewDate state')


# 7b: Pass viewDate, setViewDate, today to TT in MA render
content = patch(content,
    '{tab==="today"&&<TT E={E} wo={wo} dayOverride={dayOverride} setDayOverride={setDayOverride} go={(t,w)=>{if(prof.isPaid!==true){setShowPW(true);return;}if(w)setInitWo(w);setTab(t);}} prof={prof} logs={logs} woDay={woDay} td={td}/>}',
    '{tab==="today"&&<TT E={E} wo={wo} dayOverride={dayOverride} setDayOverride={setDayOverride} go={(t,w)=>{if(prof.isPaid!==true){setShowPW(true);return;}if(w)setInitWo(w);setTab(t);}} prof={prof} logs={logs} woDay={woDay} td={td} viewDate={viewDate} setViewDate={setViewDate} today={today}/>}',
    '7b: pass viewDate props to TT')


# 7c: Rebuild TT signature + weekDays as rolling 7-day window ending today, with grade + selected fields
content = patch(content,
    'function TT({E,wo,go,prof,logs,woDay,td,dayOverride,setDayOverride}){\n  const today=new Date();const todayDow=(today.getDay()+6)%7;\n  const weekDays=[];for(let i=0;i<7;i++){const d=new Date(today);d.setDate(today.getDate()-(todayDow-i));const k=ds(d);const schOff=i-todayDow;const schIdx=(((woDay||0)+schOff)%7+7)%7;const sch=SCH[schIdx];const done=logs[k]?.closed||false;weekDays.push({d:d.getDate(),l:["M","T","W","T","F","S","S"][i],wo:sch,today:i===todayDow,done,k});}',
    'function TT({E,wo,go,prof,logs,woDay,td,dayOverride,setDayOverride,viewDate,setViewDate,today:tk}){\n  const todayD=new Date();const DOW_L=["S","M","T","W","T","F","S"];\n  const weekDays=[];for(let i=0;i<7;i++){const d=new Date(todayD);d.setDate(todayD.getDate()-(6-i));const k=ds(d);const schIdx=(((woDay||0)+(i-6))%7+7)%7;const sch=SCH[schIdx];const lg=logs[k]||{};weekDays.push({d:d.getDate(),l:DOW_L[d.getDay()],wo:sch,today:i===6,done:lg.closed||false,k,grade:lg.grade||null,sel:k===viewDate});}',
    '7c: TT signature + rolling 7-day weekDays')


# 8a: Rewrite week strip chip rendering - tap-to-navigate, selected state, grade letter
content = patch(content,
    '<div style={{display:"flex",gap:3,marginBottom:18}}>{weekDays.map((wd,i)=><div key={i} onClick={()=>go("train")} style={{flex:1,textAlign:"center",padding:"10px 0",borderRadius:14,cursor:"pointer",background:wd.today?"#e8372c":wd.done?"#30d15808":"transparent",border:wd.today?"none":wd.done?"1px solid #30d15815":"1px solid transparent",boxShadow:wd.today?"0 4px 16px rgba(232,55,44,.3)":"none",position:"relative"}}>\n      <div style={{fontSize:9,fontWeight:700,color:wd.today?"rgba(255,255,255,.7)":"#888",letterSpacing:.5}}>{wd.l}</div>\n      <div style={{fontSize:15,fontWeight:800,color:wd.today?"#fff":wd.done?"#30d158":"#666",margin:"3px 0 2px"}}>{wd.d}</div>\n      <div style={{fontSize:7,fontWeight:700,color:wd.today?"rgba(255,255,255,.85)":wd.wo==="Rest"?"#666":"#e8372c",letterSpacing:.3,textTransform:"uppercase"}}>{wd.wo}</div>\n      {wd.done&&!wd.today&&<div style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:2,background:"#30d158",boxShadow:"0 0 4px #30d15860"}}/>}\n    </div>)}</div>',
    '<div style={{display:"flex",gap:3,marginBottom:18}}>{weekDays.map((wd,i)=>{const GC={A:"#30d158",B:"#30d158",C:"#ffd60a",D:"#ff9f0a",F:"#e8372c"};const showGrade=wd.grade&&!wd.today;return <div key={i} onClick={()=>setViewDate&&setViewDate(wd.k)} style={{flex:1,textAlign:"center",padding:"10px 0",borderRadius:14,cursor:"pointer",background:wd.today?"#e8372c":wd.sel?"#1a0a0a":wd.done?"#30d15808":"transparent",border:wd.today?"none":wd.sel?"1.5px solid #e8372c":wd.done?"1px solid #30d15815":"1px solid transparent",boxShadow:wd.today?"0 4px 16px rgba(232,55,44,.3)":"none",position:"relative",transition:"background .15s,border-color .15s"}}>\n      <div style={{fontSize:9,fontWeight:700,color:wd.today?"rgba(255,255,255,.7)":"#888",letterSpacing:.5}}>{wd.l}</div>\n      <div style={{fontSize:15,fontWeight:800,color:wd.today?"#fff":wd.done?"#30d158":"#666",margin:"3px 0 2px"}}>{wd.d}</div>\n      {showGrade?<div style={{fontSize:13,fontWeight:800,color:GC[wd.grade]||"#666",letterSpacing:0,lineHeight:1}}>{wd.grade}</div>:<div style={{fontSize:7,fontWeight:700,color:wd.today?"rgba(255,255,255,.85)":wd.wo==="Rest"?"#666":"#e8372c",letterSpacing:.3,textTransform:"uppercase"}}>{wd.wo}</div>}\n      {wd.done&&!wd.today&&!wd.grade&&<div style={{position:"absolute",bottom:4,left:"50%",transform:"translateX(-50%)",width:4,height:4,borderRadius:2,background:"#30d158",boxShadow:"0 0 4px #30d15860"}}/>}\n    </div>;})}</div>',
    '8a: interactive week strip with grades + selected state')


# 8b: Insert "Viewing past day" header with "← Today" jump button (only renders when viewDate !== today)
content = patch(content,
    '</div>;})}</div>\n    <Cd style={{display:"flex",alignItems:"center",gap:20,marginBottom:14}}>',
    '</div>;})}</div>\n    {viewDate!==tk&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,padding:"0 4px"}}><div style={{fontSize:14,fontWeight:600,color:"#fff"}}>{(()=>{const dd=new Date(viewDate+"T12:00:00");return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dd.getDay()]+", "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dd.getMonth()]+" "+dd.getDate();})()}</div><button onClick={()=>setViewDate(tk)} style={{padding:"6px 11px",borderRadius:11,background:"rgba(232,55,44,.1)",border:"1px solid rgba(232,55,44,.3)",color:"#e8372c",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>← Today</button></div>}\n    <Cd style={{display:"flex",alignItems:"center",gap:20,marginBottom:14}}>',
    '8b: viewing-past-day header + Today jump button')


# Write-on-success-only
print()
if content == ORIGINAL:
    print("No changes computed. File unchanged.")
elif DRY_RUN:
    print(f"Dry run OK. {len(content) - len(ORIGINAL):+d} bytes delta. No write.")
else:
    FILE.write_text(content)
    print(f"Wrote {FILE}. {len(content) - len(ORIGINAL):+d} bytes delta.")
print("Surgery 7+8 complete. 5 patches applied.")
