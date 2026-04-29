#!/usr/bin/env python3
"""Surgery #1: Katch-McArdle BMR + std activity multipliers + metabolism multiplier."""
import re, sys
from pathlib import Path

PATH = Path("src/app/page.js")
if not PATH.exists():
    print(f"ERROR: {PATH} not found. Run from ~/calibr8-dev/")
    sys.exit(1)

original = PATH.read_text()
content = original
errors = []

# Exact strings (avoid regex headaches)
OLD_CTDEE = 'function cTDEE(w,h,a,s,act){const wK=w*.4536,hC=h*2.54,bmr=s==="male"?10*wK+6.25*hC-5*a+5:10*wK+6.25*hC-5*a-161;const m=act==="Not training"?1.2:act==="1-2x/week"?1.3:act==="3-4x/week"?1.45:1.55;return Math.round(bmr*m);}'
NEW_CTDEE = 'function cTDEE(w,h,a,s,act,met,bf){const wK=w*0.4536,hC=h*2.54;let bmr;if(bf&&bf>0&&bf<60){const lbm=wK*(1-bf/100);bmr=370+21.6*lbm;}else{bmr=s==="male"?10*wK+6.25*hC-5*a+5:10*wK+6.25*hC-5*a-161;}const m=act==="Not training"?1.2:act==="1-2x/week"?1.375:act==="3-4x/week"?1.55:1.725;const mm=met==="fast"?1.08:met==="slow"?0.95:1.0;return Math.round(bmr*m*mm);}'

print("=" * 60)
print("PHASE 1: VERIFY ALL PATTERNS EXIST IN SOURCE")
print("=" * 60)

checks = [
    ("cTDEE function (exact)",            OLD_CTDEE,                                                                                                       1),
    ("OB state init",                     'drink:"",train:"",aiBfNow:null',                                                                                1),
    ("st===6 training freq block",        '{st===6&&<div><H>How often do',                                                                                 1),
    ("st===7 AI disclosure block",        '{st===7&&!f.aiDisclosureAccepted&&<div>',                                                                       1),
    ("st===7 BF method block",            '{st===7&&f.aiDisclosureAccepted&&<div>',                                                                        1),
    ("st===10 review block",              '{st===10&&<div><H>Your plan is<br/><Red>ready.</Red>',                                                          1),
    ("ok validation array",               'const ok=[f.un.trim()&&f.name.trim()&&f.lastName.trim()&&pwOk&&pwM&&unStatus!=="taken",f.hF&&f.hI,!!f.w,!!f.age,!!f.sex,!!f.drink,!!f.train,true,!!f.gw,!!f.dl,f.tosAccepted];', 1),
    ("Continue btn onClick",              'onClick={st<10?()=>{setSubErr("");if(st===7&&!f.aiDisclosureAccepted)',                                         1),
    ("Continue btn label condition",      'st<10?"Continue":"Let\'s Go"',                                                                                  1),
    ("OB cTDEE call (line 85)",           'const tdee=hI?cTDEE(+f.w||150,hI,+f.age||25,f.sex||"male",f.train||"3-4x/week"):2000;',                         1),
    ("fin onCreate payload",              'drink:f.drink,train:f.train,sd:ds()',                                                                           1),
    ("Settings cTDEE call",               'const tdee=cTDEE(prof.w||150,prof.hIn||69,prof.age||25,prof.sex||"male",prof.train||"3-4x/week");',             1),
]

for desc, pattern, expected in checks:
    actual = content.count(pattern)
    status = "PASS" if actual == expected else "FAIL"
    print(f"  [{status}] {desc}: found {actual}, expected {expected}")
    if actual != expected:
        errors.append(f"{desc}: found {actual}, expected {expected}")

if errors:
    print("\nABORT - pattern mismatches:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)

print("\nAll patterns verified. Proceeding.\n")

def count_st(c, n):
    return len(re.findall(rf'\bst==={n}\b', c))

print("Original step counts:")
for n in [6, 7, 8, 9, 10, 11]:
    print(f"  st==={n}: {count_st(original, n)}")

print("\n" + "=" * 60)
print("PHASE 2: RENUMBER EXISTING STEPS (high to low)")
print("=" * 60)
content = re.sub(r'\bst===10\b', 'st===11', content); print("  st===10 -> st===11")
content = re.sub(r'\bst===9\b', 'st===10', content); print("  st===9 -> st===10")
content = re.sub(r'\bst===8\b', 'st===9', content); print("  st===8 -> st===9")
content = re.sub(r'\bst===7\b', 'st===8', content); print("  st===7 -> st===8")

print("\nAfter renumbering:")
for n in [6, 7, 8, 9, 10, 11]:
    print(f"  st==={n}: {count_st(content, n)}")

if count_st(content, 7) != 0:
    print("ABORT: st===7 should be 0 after renumber")
    sys.exit(1)

print("\n" + "=" * 60)
print("PHASE 3: INSERT METABOLISM STEP AT st===7")
print("=" * 60)

METABOLISM_STEP = '{st===7&&<div><H>Your <Red>metabolism?</Red></H><Sb>Some bodies burn calories faster than others. Pick what fits you.</Sb><div style={{height:32}}/><div style={{display:"flex",flexDirection:"column",gap:8}}><OptCard icon={Ico.fire} label="Fast metabolism" desc="Hard to gain weight, always feel warm" active={f.metabolism==="fast"} onClick={()=>u("metabolism","fast")}/><OptCard icon={Ico.bolt} label="Average metabolism" desc="Weight responds normally to diet changes" active={f.metabolism==="average"} onClick={()=>u("metabolism","average")}/><OptCard icon={Ico.rest} label="Slow metabolism" desc="Easy to gain, hard to lose weight" active={f.metabolism==="slow"} onClick={()=>u("metabolism","slow")}/></div><div style={{fontSize:11,color:"#666",marginTop:18,lineHeight:1.6,padding:"0 4px"}}>This adjusts your daily targets by plus or minus 5-8% to match your body. You can change it anytime in Settings.</div></div>}'

TARGET = '{st===8&&!f.aiDisclosureAccepted'
if content.count(TARGET) != 1:
    print(f"ABORT: insertion target appears {content.count(TARGET)} times, expected 1")
    sys.exit(1)
content = content.replace(TARGET, METABOLISM_STEP + TARGET, 1)
print("  Inserted metabolism step")

if count_st(content, 7) != 1:
    print(f"ABORT: expected exactly 1 st===7 after insert, got {count_st(content, 7)}")
    sys.exit(1)

print("\nAfter insertion:")
for n in [6, 7, 8, 9, 10, 11]:
    print(f"  st==={n}: {count_st(content, n)}")

print("\n" + "=" * 60)
print("PHASE 4: REPLACE cTDEE FUNCTION (exact string)")
print("=" * 60)
if OLD_CTDEE not in content:
    print("ABORT: cTDEE function not found in current state")
    sys.exit(1)
content = content.replace(OLD_CTDEE, NEW_CTDEE, 1)
print("  Replaced cTDEE: now (w,h,a,s,act,met,bf) with Katch + std multipliers")

print("\n" + "=" * 60)
print("PHASE 5: ADD metabolism FIELD TO OB STATE")
print("=" * 60)
content = content.replace('drink:"",train:"",aiBfNow:null', 'drink:"",train:"",metabolism:"",aiBfNow:null', 1)
print("  Added metabolism field")

print("\n" + "=" * 60)
print("PHASE 6: UPDATE OK VALIDATION ARRAY")
print("=" * 60)
content = content.replace(
    'const ok=[f.un.trim()&&f.name.trim()&&f.lastName.trim()&&pwOk&&pwM&&unStatus!=="taken",f.hF&&f.hI,!!f.w,!!f.age,!!f.sex,!!f.drink,!!f.train,true,!!f.gw,!!f.dl,f.tosAccepted];',
    'const ok=[f.un.trim()&&f.name.trim()&&f.lastName.trim()&&pwOk&&pwM&&unStatus!=="taken",f.hF&&f.hI,!!f.w,!!f.age,!!f.sex,!!f.drink,!!f.train,!!f.metabolism,true,!!f.gw,!!f.dl,f.tosAccepted];',
    1
)
print("  Added !!f.metabolism check at index 7")

print("\n" + "=" * 60)
print("PHASE 7: UPDATE CONTINUE BUTTON")
print("=" * 60)
content = content.replace(
    'onClick={st<10?()=>{setSubErr("");if(st===7&&!f.aiDisclosureAccepted)',
    'onClick={st<11?()=>{setSubErr("");if(st===8&&!f.aiDisclosureAccepted)',
    1
)
print("  Updated Continue button onClick")
content = content.replace('st<10?"Continue":"Let\'s Go"', 'st<11?"Continue":"Let\'s Go"', 1)
print("  Updated Continue button text")

print("\n" + "=" * 60)
print("PHASE 8: UPDATE OB cTDEE CALL")
print("=" * 60)
content = content.replace(
    'const tdee=hI?cTDEE(+f.w||150,hI,+f.age||25,f.sex||"male",f.train||"3-4x/week"):2000;',
    'const tdee=hI?cTDEE(+f.w||150,hI,+f.age||25,f.sex||"male",f.train||"3-4x/week",f.metabolism||"average",cBF):2000;',
    1
)
print("  Onboarding cTDEE call updated")

print("\n" + "=" * 60)
print("PHASE 9: UPDATE fin PAYLOAD")
print("=" * 60)
content = content.replace(
    'drink:f.drink,train:f.train,sd:ds()',
    'drink:f.drink,train:f.train,metabolism:f.metabolism||"average",mathVersion:2,sd:ds()',
    1
)
print("  Profile creation now stores metabolism + mathVersion:2")

print("\n" + "=" * 60)
print("PHASE 10: UPDATE SETTINGS cTDEE CALL")
print("=" * 60)
content = content.replace(
    'const tdee=cTDEE(prof.w||150,prof.hIn||69,prof.age||25,prof.sex||"male",prof.train||"3-4x/week");',
    'const tdee=cTDEE(prof.w||150,prof.hIn||69,prof.age||25,prof.sex||"male",prof.train||"3-4x/week",prof.metabolism||"average",bf);',
    1
)
print("  Settings cTDEE call updated")

print("\n" + "=" * 60)
print("FINAL VERIFICATION")
print("=" * 60)
expected_st = {6: 1, 7: 1, 8: 2, 9: 1, 10: 1, 11: 1}
all_good = True
for n, exp in expected_st.items():
    actual = count_st(content, n)
    status = "PASS" if actual == exp else "FAIL"
    print(f"  [{status}] st==={n}: expected {exp}, got {actual}")
    if actual != exp:
        all_good = False

verifications = [
    ('Katch-McArdle in cTDEE',           'bmr=370+21.6*lbm'),
    ('Standard multiplier 1.55/1.725',   'act==="3-4x/week"?1.55:1.725'),
    ('Metabolism modifier in cTDEE',     'mm=met==="fast"?1.08:met==="slow"?0.95:1.0'),
    ('Metabolism field in state',        'metabolism:""'),
    ('Metabolism in fin payload',        'metabolism:f.metabolism||"average"'),
    ('mathVersion:2 in fin',             'mathVersion:2'),
    ('OB cTDEE passes metabolism+cBF',   'f.metabolism||"average",cBF'),
    ('Settings cTDEE passes met+bf',     'prof.metabolism||"average",bf'),
    ('Continue btn st<11',               'onClick={st<11?'),
    ('Continue btn st===8 check',        'if(st===8&&!f.aiDisclosureAccepted)'),
    ('OK array includes metabolism',     '!!f.train,!!f.metabolism,true'),
    ('Metabolism step JSX present',      '<H>Your <Red>metabolism?</Red></H>'),
]

for desc, pattern in verifications:
    found = pattern in content
    status = "PASS" if found else "FAIL"
    print(f"  [{status}] {desc}")
    if not found:
        all_good = False

if not all_good:
    print("\nABORT - verification failed. NOT writing file.")
    sys.exit(1)

PATH.write_text(content)
print("\n" + "=" * 60)
print(f"SUCCESS - wrote {PATH}")
print("=" * 60)
print(f"  Original size: {len(original)} bytes")
print(f"  New size:      {len(content)} bytes")
print(f"  Delta:         {len(content) - len(original):+d} bytes")
print(f"\nNext: run 'npm run build' to verify it compiles.")
