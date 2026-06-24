#!/usr/bin/env python3
"""
Surgery 6: Custom Exercise Full Integration  (FIXED v2)

Changes from original:
  - FILE path corrected: src/app/page.js (was src/components/PrimeApp.js)
  - Added --dry-run flag: validates all anchors without writing
  - Write-on-success-only: file only written if ALL patches succeed
  - Diagnostic dump shows surrounding context on failure

Usage:
  python3 surgery6_fixed.py --dry-run   # validate only, no changes
  python3 surgery6_fixed.py             # apply changes
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
            print(f"  ACTUAL (first 200 chars):")
            print(f"    {repr(actual[:200])}")
            print(f"  EXPECTED:")
            print(f"    {repr(find[:200])}")
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

# 6d-1: wCal calc in E useMemo
content = patch(content,
    '(t.myEx||[]).forEach(ex=>{const ss=ex.sets?.filter(s=>s.w&&s.r).length||1;wCal+=Math.round(4.5*bw*ss*3.5/60);ex.sets?.forEach(s=>{vol+=(+s.w||0)*(+s.r||0);});});',
    "['myEx','myExPush','myExPull','myExLegs'].forEach(mk=>(t[mk]||[]).forEach(ex=>{const fs=ex.sets?.filter(s=>s.w&&s.r).length||0;const ss=fs||(ex.done?(ex.sets?.length||1):0);if(ss>0){const met=ex.met||4.5;wCal+=Math.round(met*bw*ss*(met>=5?3.5:2.5)/60);}ex.sets?.forEach(s=>{vol+=(+s.w||0)*(+s.r||0);});}));",
    '6d-1: wCal calc')

# 6e-1: Weekly average (wN) calc
content = patch(content,
    '(dx.myEx||[]).forEach(ex=>{wc+=Math.round(4.5*bw*(ex.sets?.filter(s=>s.w&&s.r).length||1)*3.5/60)});',
    "['myEx','myExPush','myExPull','myExLegs'].forEach(mk=>(dx[mk]||[]).forEach(ex=>{const fs=ex.sets?.filter(s=>s.w&&s.r).length||0;const ss=fs||(ex.done?(ex.sets?.length||1):0);if(ss>0){const met=ex.met||4.5;wc+=Math.round(met*bw*ss*(met>=5?3.5:2.5)/60);}}));",
    '6e-1: weekly avg calc')

# 6e-2: NetStreak calc (uses wc2)
content = patch(content,
    '(dx.myEx||[]).forEach(ex=>{wc2+=Math.round(4.5*bw*(ex.sets?.filter(s=>s.w&&s.r).length||1)*3.5/60)});',
    "['myEx','myExPush','myExPull','myExLegs'].forEach(mk=>(dx[mk]||[]).forEach(ex=>{const fs=ex.sets?.filter(s=>s.w&&s.r).length||0;const ss=fs||(ex.done?(ex.sets?.length||1):0);if(ss>0){const met=ex.met||4.5;wc2+=Math.round(met*bw*ss*(met>=5?3.5:2.5)/60);}}));",
    '6e-2: netStreak calc')

# 6f: TT dots history - inject myEx loop before cardio
content = patch(content,
    "['woPush','woPull','woLegs'].forEach(wk=>(dx[wk]||[]).forEach(ex=>{if(ex.done)wc+=Math.round((ex.met||4)*bw*3*((ex.met||4)>=5?3.5:2.5)/60)}));(dx.cardio||[]).forEach(c=>{wc+=Math.round((c.met||5)*bw*(c.mins||30)/60)});dots.push",
    "['woPush','woPull','woLegs'].forEach(wk=>(dx[wk]||[]).forEach(ex=>{if(ex.done)wc+=Math.round((ex.met||4)*bw*3*((ex.met||4)>=5?3.5:2.5)/60)}));['myEx','myExPush','myExPull','myExLegs'].forEach(mk=>(dx[mk]||[]).forEach(ex=>{const fs=ex.sets?.filter(s=>s.w&&s.r).length||0;const ss=fs||(ex.done?(ex.sets?.length||1):0);if(ss>0){const met=ex.met||4.5;wc+=Math.round(met*bw*ss*(met>=5?3.5:2.5)/60);}}));(dx.cardio||[]).forEach(c=>{wc+=Math.round((c.met||5)*bw*(c.mins||30)/60)});dots.push",
    '6f: TT dots history')

# 6b: Today day card - remove cap on custom exercises + add arr param
content = patch(content,
    '[...exercises.slice(0,6),...myExs.slice(0,Math.max(0,6-exercises.length)).map(ex=>({n:ex.name,s:ex.sets?.length||0,r:"",m:Array.isArray(ex.muscles)?ex.muscles[0]:ex.muscles||"",done:ex.sets?.every(s=>s.w&&s.r)||false,log:ex.sets||[],_my:true}))].map((ex,i)=>',
    '[...exercises.slice(0,6),...myExs.map(ex=>({n:ex.name,s:ex.sets?.length||0,r:"",m:Array.isArray(ex.muscles)?ex.muscles[0]:ex.muscles||"",done:ex.done||(ex.sets?.length>0&&ex.sets.every(s=>s.w&&s.r))||false,log:ex.sets||[],_my:true}))].map((ex,i,arr)=>',
    '6b: Today card cap')

# 6b-2: Dynamic borderBottom
content = patch(content,
    'borderBottom:i<5?"1px solid #080808":"none",background:ex.done?"rgba(48,209,88,.06)":"transparent"',
    'borderBottom:i<arr.length-1?"1px solid #080808":"none",background:ex.done?"rgba(48,209,88,.06)":"transparent"',
    '6b-2: dynamic borderBottom')

# 6c-1: Custom exercise name + Bx border reflect done state
content = patch(content,
    '{my.map((ex,ei)=> <Bx key={ei} style={{borderColor:"#0a84ff30"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div><div style={{fontSize:14,fontWeight:600,color:"#0a84ff"}}>{ex.name}</div>',
    '{my.map((ex,ei)=> <Bx key={ei} style={{borderColor:ex.done?"#30d15830":"#0a84ff30"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div><div style={{fontSize:14,fontWeight:600,color:ex.done?"#30d158":"#0a84ff"}}>{ex.name}</div>',
    '6c-1: custom exercise color when done')

# 6c-2: Add done toggle button alongside remove
content = patch(content,
    '{exDiag==="c"+ei&&<MuscDiag muscle={Array.isArray(ex.muscles)?ex.muscles[0]:ex.muscles} tips={ex.tips} onClose={()=>setExDiag(null)}/>}</>}</div><button onClick={()=>rmE(ei)} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:16}}>\u00d7</button></div>',
    '{exDiag==="c"+ei&&<MuscDiag muscle={Array.isArray(ex.muscles)?ex.muscles[0]:ex.muscles} tips={ex.tips} onClose={()=>setExDiag(null)}/>}</>}</div><div style={{display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>{set(p=>{const exs=[...(p[myKey]||[])];exs[ei]={...exs[ei],done:!exs[ei].done};return{...p,[myKey]:exs};});}} style={{width:32,height:32,borderRadius:10,border:ex.done?"none":"2px solid #222",background:ex.done?"#30d158":"transparent",cursor:"pointer",color:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>{ex.done?"\u2713":""}</button><button onClick={()=>rmE(ei)} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:16}}>\u00d7</button></div></div>',
    '6c-2: add done toggle to custom exercises')

# 6g: closeDay grade API - send all custom exercise keys
content = patch(content,
    "workout:{exercises:td.myEx||[],submitted:td.woSub||false,presetDone:['woPush','woPull','woLegs'].reduce((a,k)=>a+(td[k]||[]).filter(e=>e.done).length,0)}",
    "workout:{exercises:[...(td.myEx||[]),...(td.myExPush||[]),...(td.myExPull||[]),...(td.myExLegs||[])],submitted:td.woSub||false,presetDone:['woPush','woPull','woLegs'].reduce((a,k)=>a+(td[k]||[]).filter(e=>e.done).length,0)}",
    '6g: closeDay grade API')

# Write-on-success-only
print()
if content == ORIGINAL:
    print("No changes computed. File unchanged.")
elif DRY_RUN:
    print(f"Dry run OK. {len(content) - len(ORIGINAL):+d} bytes delta. No write.")
else:
    FILE.write_text(content)
    print(f"Wrote {FILE}. {len(content) - len(ORIGINAL):+d} bytes delta.")
print("Surgery 6 complete. 9 patches applied.")
