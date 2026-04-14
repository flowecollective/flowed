import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";

/* ── Global CSS ─────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Jost:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'Jost',sans-serif;background:#FAF7F2;color:#1C1815;-webkit-font-smoothing:antialiased}
input,textarea,select{font-family:'Jost',sans-serif;font-size:14px;outline:none;border:1.5px solid #E0D8CF;background:#fff;color:#1C1815;border-radius:6px;padding:10px 14px;width:100%;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;appearance:none}
input:focus,textarea:focus,select:focus{border-color:#B8956A;box-shadow:0 0 0 3px rgba(184,149,106,.12)}
input[type=checkbox]{width:auto;padding:0}
textarea{resize:vertical;min-height:72px;line-height:1.5}
button{cursor:pointer;font-family:'Jost',sans-serif;border:none;outline:none}
::placeholder{color:#C0B8B0}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#D4C4B4;border-radius:3px}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp .35s cubic-bezier(.2,.8,.4,1) both}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.fade-in{animation:fadeIn .25s ease both}
.ev-card{transition:box-shadow .18s,transform .18s}
.ev-card:hover{box-shadow:0 4px 20px rgba(61,53,48,.10);transform:translateY(-1px)}
.check-row:hover{background:#F0EBE1 !important}
`;
if (!document.getElementById("bbp-css")) {
  const s = document.createElement("style");
  s.id = "bbp-css"; s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);

const ROLES = [
  { v:"bride",        l:"Bride",              color:"#C4979A", bg:"#F8EDED" },
  { v:"moh",          l:"Maid of Honor",       color:"#B8956A", bg:"#F7EFDF" },
  { v:"bridesmaid",   l:"Bridesmaid",          color:"#7B9E87", bg:"#EBF2ED" },
  { v:"mother_bride", l:"Mother of Bride",     color:"#7B8FA0", bg:"#EAF0F5" },
  { v:"mother_groom", l:"Mother of Groom",     color:"#9B8FBA", bg:"#F0EBF8" },
  { v:"flower_girl",  l:"Flower Girl",         color:"#B89B7A", bg:"#F5EFEA" },
  { v:"other",        l:"Other",               color:"#8F8880", bg:"#F0EDE8" },
];
const SERVICES = [
  { v:"hair",   l:"Hair Only",     icon:"✦" },
  { v:"makeup", l:"Makeup Only",   icon:"◆" },
  { v:"both",   l:"Hair & Makeup", icon:"✦◆" },
];
const SPECIALTIES = [
  { v:"hair",   l:"Hair Stylist"  },
  { v:"makeup", l:"Makeup Artist" },
  { v:"both",   l:"Hair & Makeup" },
];
const STYLIST_PALETTE = ["#B8956A","#7B9E87","#C4979A","#7B8FA0","#9B8FBA","#A08060"];
const PRIORITY = { bride:0, moh:1, bridesmaid:2, mother_bride:3, mother_groom:4, flower_girl:5, other:6 };
const TBlock = { hair:{bg:"#EBF2ED",border:"#7B9E87",text:"#3A6B4C"}, makeup:{bg:"#F8EDED",border:"#C4979A",text:"#8B4A55"} };

const PACKING_MASTER = [
  { id:"hair-tools",   label:"Hair Tools",              icon:"✦", items:["Flat iron","Curling iron / wand","Blow dryer","Diffuser attachment","Round brushes (assorted)","Teasing brush","Tail comb","Wide tooth comb","Sectioning clips (large)","Bobby pins — assorted","U-pins / hair pins","Hair elastics — clear + black","Sectioning spray bottle"] },
  { id:"hair-prod",    label:"Hair Products",           icon:"◈", items:["Heat protectant spray","Hairspray — medium hold","Hairspray — strong hold","Texturizing spray","Dry shampoo","Shine serum / oil","Mousse / volumizer","Pomade / edge control","Setting spray"] },
  { id:"mkup-tools",   label:"Makeup Tools",            icon:"✧", items:["Foundation brushes","Blending sponges","Eyeshadow brushes — flat + blending","Powder brush","Blush + contour brush","Fan brush","Lip brush","Tweezers","Lash applicator","Small scissors","Palette spatula"] },
  { id:"mkup-prod",    label:"Makeup Products",         icon:"◇", items:["Primer — face + eye","Foundation (shade range)","Concealer","Setting powder","Contour palette","Blush","Highlight","Eyeshadow palettes","Eyeliner — pencil + liquid","Mascara","False lashes — assorted styles","Lash glue","Lip liner","Lipstick / gloss — assorted","Brow products","Setting spray"] },
  { id:"skincare",     label:"Skincare Prep",           icon:"○", items:["Facial mist","Lightweight moisturizer","Eye patches","Blotting papers","Barrier / finishing cream"] },
  { id:"disposables",  label:"Disposables & Sanitation",icon:"△", items:["Disposable lip applicators","Disposable mascara wands","Cotton rounds","Cotton swabs","Tissues","Alcohol wipes","Gloves","Neck strips / cape liners"] },
  { id:"comfort",      label:"Client Comfort",          icon:"☽", items:["Styling capes / robes","Hand mirror (client-facing)","Snacks for clients","Water / beverages","Touch-up kit for bride"] },
  { id:"team",         label:"Team & Admin",            icon:"□", items:["Portable charger","Extension cord / power strip","Surge protector","Bluetooth speaker","Phone stand / ring light","Business cards","Tip envelopes","Contract copies","Emergency kit (pain reliever, bandages, safety pins)","Trash bags","Snacks + water for team"] },
];

/* ── Utilities ──────────────────────────────────────────────────────────── */
const getRoleInfo    = (v) => ROLES.find(r=>r.v===v)||ROLES[ROLES.length-1];
const getServiceInfo = (v) => SERVICES.find(s=>s.v===v)||SERVICES[2];
const parseTime = (t) => { if(!t) return 0; const [h,m]=t.split(":").map(Number); return h*60+(m||0); };
const fmtTime = (mins) => {
  const h=Math.floor(mins/60)%24, m=mins%60;
  const ampm=h>=12?"PM":"AM", h12=h>12?h-12:h===0?12:h;
  return `${h12}:${m.toString().padStart(2,"0")} ${ampm}`;
};
const fmtDate = (d) => d ? new Date(d+"T12:00").toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric",year:"numeric"}) : "";
const daysUntil = (d) => { if(!d) return null; return Math.ceil((new Date(d+"T12:00")-new Date())/(1000*60*60*24)); };

const buildSchedule = (members, stylists, readyBy) => {
  if (!members.length||!readyBy) return { tracks:[], start:null, end:null };
  const readyByMins=parseTime(readyBy);
  const sorted=[...members].sort((a,b)=>(PRIORITY[a.role]??6)-(PRIORITY[b.role]??6));
  const all=stylists.length?stylists:[{id:"tbd",name:"Styling Team",specialty:"both"}];
  const hairSt=all.filter(s=>s.specialty==="hair"||s.specialty==="both");
  const mkupSt=all.filter(s=>s.specialty==="makeup"||s.specialty==="both");
  if (!hairSt.length) hairSt.push(...all);
  if (!mkupSt.length) mkupSt.push(...all);
  const tracks={};
  [...new Set([...hairSt,...mkupSt].map(s=>s.id))].forEach(id=>{
    tracks[id]={ stylist:all.find(s=>s.id===id), slots:[], nextEnd:readyByMins };
  });
  const pickBest=(stList)=>stList.reduce((best,s)=>tracks[s.id].nextEnd>tracks[best.id].nextEnd?s:best,stList[0]);
  for (const m of sorted.filter(m=>m.services==="hair"||m.services==="both")) {
    const dur=m.role==="bride"?90:60, st=pickBest(hairSt);
    const end=tracks[st.id].nextEnd, start=end-dur;
    tracks[st.id].slots.push({memberId:m.id,name:m.name,role:m.role,type:"hair",start,end,dur});
    tracks[st.id].nextEnd=start;
  }
  Object.keys(tracks).forEach(id=>{
    const sp=tracks[id].stylist?.specialty;
    if (sp==="both"){const hs=tracks[id].slots.filter(s=>s.type==="hair");tracks[id].nextEnd=hs.length?Math.min(...hs.map(s=>s.start)):readyByMins;}
    else if(sp==="makeup"){tracks[id].nextEnd=readyByMins;}
  });
  for (const m of sorted.filter(m=>m.services==="makeup"||m.services==="both")) {
    const dur=m.role==="bride"?60:45, st=pickBest(mkupSt);
    const end=tracks[st.id].nextEnd, start=end-dur;
    tracks[st.id].slots.push({memberId:m.id,name:m.name,role:m.role,type:"makeup",start,end,dur});
    tracks[st.id].nextEnd=start;
  }
  Object.values(tracks).forEach(t=>t.slots.sort((a,b)=>a.start-b.start));
  const live=Object.values(tracks).filter(t=>t.slots.length);
  const allStarts=live.flatMap(t=>t.slots.map(s=>s.start));
  return {tracks:live,start:allStarts.length?Math.min(...allStarts):null,end:readyByMins};
};

const getSmartSuggestions = (members, details) => {
  const s=[];
  const h=members.filter(m=>m.services==="hair"||m.services==="both").length;
  const mk=members.filter(m=>m.services==="makeup"||m.services==="both").length;
  const p=members.length;
  const hasFlowerGirls=members.some(m=>m.role==="flower_girl");
  const hasExtensions=details.hasExtensions;
  const isOutdoor=details.isOutdoor;
  if (h>=4) s.push({text:`Extra bobby pins — large party (${h} hair clients)`,cat:"Hair Tools"});
  if (h>=4) s.push({text:"Extra sectioning clips",cat:"Hair Tools"});
  if (h>=5) s.push({text:"Second curling iron / backup wand",cat:"Hair Tools"});
  if (h>=6) s.push({text:"Second flat iron — high volume",cat:"Hair Tools"});
  if (h>=6) s.push({text:"Second blow dryer",cat:"Hair Tools"});
  if (mk>=4) s.push({text:`Extra blending sponges (${mk} makeup clients)`,cat:"Makeup Tools"});
  if (mk>=4) s.push({text:"Extra setting spray",cat:"Makeup Products"});
  if (mk>=6) s.push({text:"Backup mascara — high volume",cat:"Makeup Products"});
  if (hasExtensions) s.push({text:"Extension wefts / units",cat:"Hair Tools"});
  if (hasExtensions) s.push({text:"Micro ring / k-tip application tools",cat:"Hair Tools"});
  if (hasExtensions) s.push({text:"Bond remover",cat:"Hair Products"});
  if (hasFlowerGirls) s.push({text:"Gentler hold products for flower girls",cat:"Hair Products"});
  if (hasFlowerGirls) s.push({text:"Gentle / sensitive skin makeup for young clients",cat:"Makeup Products"});
  if (isOutdoor) s.push({text:"Extra anti-humidity hairspray",cat:"Hair Products"});
  if (isOutdoor) s.push({text:"Extra waterproof setting spray",cat:"Makeup Products"});
  if (isOutdoor) s.push({text:"Waterproof mascara — outdoor ceremony",cat:"Makeup Products"});
  if (isOutdoor) s.push({text:"Sunscreen (team + client touch-up)",cat:"Team & Admin"});
  if (p>=8) s.push({text:"Extra robes / capes",cat:"Client Comfort"});
  if (p>=8) s.push({text:"Second mirror setup",cat:"Client Comfort"});
  return s;
};

/* ── Shared UI ──────────────────────────────────────────────────────────── */
const Btn = ({ children, onClick, variant="primary", size="md", disabled, style:sx={} }) => {
  const base={display:"inline-flex",alignItems:"center",gap:6,fontWeight:500,borderRadius:6,transition:"all .18s",letterSpacing:".01em",padding:size==="sm"?"7px 14px":"11px 22px",fontSize:size==="sm"?13:14,whiteSpace:"nowrap"};
  const vs={primary:{background:"#B8956A",color:"#fff",border:"none"},secondary:{background:"transparent",color:"#B8956A",border:"1.5px solid #B8956A"},ghost:{background:"transparent",color:"#6B6058",border:"1.5px solid #E0D8CF"},danger:{background:"transparent",color:"#C06060",border:"1.5px solid #e0c0c0"}};
  return <button onClick={onClick} disabled={disabled} style={{...base,...vs[variant],opacity:disabled?.45:1,cursor:disabled?"not-allowed":"pointer",...sx}}>{children}</button>;
};

const Label = ({children}) => <div style={{fontSize:11,fontWeight:500,letterSpacing:".08em",textTransform:"uppercase",color:"#8A8078",marginBottom:6}}>{children}</div>;
const Field = ({label,children,col}) => <div style={{marginBottom:16,gridColumn:col}}>{label&&<Label>{label}</Label>}{children}</div>;
const Divider = ({label}) => <div style={{display:"flex",alignItems:"center",gap:12,margin:"22px 0"}}><div style={{flex:1,height:1,background:"#E8E0D8"}}/>{label&&<span style={{fontSize:11,letterSpacing:".1em",textTransform:"uppercase",color:"#B0A8A0"}}>{label}</span>}<div style={{flex:1,height:1,background:"#E8E0D8"}}/></div>;
const RolePill = ({role}) => { const r=getRoleInfo(role); return <span style={{display:"inline-block",padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:500,background:r.bg,color:r.color}}>{r.l}</span>; };
const ServicePill = ({svc}) => {
  const s=getServiceInfo(svc);
  const colors={hair:{bg:"#EBF2ED",color:"#4A7A5A"},makeup:{bg:"#F8EDED",color:"#96606A"},both:{bg:"#F7EFDF",color:"#9A7548"}};
  const c=colors[svc]||colors.both;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:500,background:c.bg,color:c.color}}><span style={{fontSize:9}}>{s.icon}</span>{s.l}</span>;
};
const InspoThumb = ({url}) => {
  const [err,setErr]=useState(false);
  const [open,setOpen]=useState(false);
  return <>
    <div onClick={()=>!err&&setOpen(true)} style={{width:56,height:56,borderRadius:6,overflow:"hidden",background:"#F0EAE2",flexShrink:0,position:"relative",cursor:err?"default":"zoom-in"}}>{!err?<img src={url} alt="inspo" onError={()=>setErr(true)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<a href={url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:22,textDecoration:"none"}}>🔗</a>}</div>
    {open&&<div onClick={()=>setOpen(false)} className="fade-in" style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(28,24,21,.85)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out",padding:24}}>
      <img src={url} alt="inspo" style={{maxWidth:"90vw",maxHeight:"85vh",borderRadius:10,objectFit:"contain",boxShadow:"0 8px 40px rgba(0,0,0,.4)"}}/>
    </div>}
  </>;
};
const Toggle = ({value, onChange, label}) => (
  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:13,color:"#6B6058"}}>
    <div onClick={()=>onChange(!value)} style={{width:18,height:18,borderRadius:4,border:`1.5px solid ${value?"#B8956A":"#E0D8CF"}`,background:value?"#B8956A":"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all .15s"}}>
      {value&&<span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
    </div>
    {label}
  </label>
);

/* ── Step Nav ───────────────────────────────────────────────────────────── */
const STEPS=[{n:1,l:"Event"},{n:2,l:"Party"},{n:3,l:"Team"},{n:4,l:"Timeline"},{n:5,l:"Packing"}];
const StepNav = ({step,setStep}) => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0,marginBottom:36}}>
    {STEPS.map((s,i)=>(
      <div key={s.n} style={{display:"flex",alignItems:"center"}}>
        <div onClick={()=>setStep(s.n)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer"}}>
          <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:step===s.n?"#B8956A":step>s.n?"#7B9E87":"#E8E0D8",color:step>=s.n?"#fff":"#A0988E",fontSize:11,fontWeight:600,transition:"all .3s",boxShadow:step===s.n?"0 4px 14px rgba(184,149,106,.35)":"none"}}>{step>s.n?"✓":s.n}</div>
          <span style={{fontSize:10,letterSpacing:".08em",textTransform:"uppercase",color:step===s.n?"#B8956A":"#A0988E",fontWeight:step===s.n?500:400}}>{s.l}</span>
        </div>
        {i<STEPS.length-1&&<div style={{width:36,height:1.5,background:step>s.n?"#7B9E87":"#E8E0D8",marginBottom:22,transition:"background .3s"}}/>}
      </div>
    ))}
  </div>
);

/* ── Step 1: Event Details ──────────────────────────────────────────────── */
const DayCard = ({day,idx,total,onChange,onRemove}) => (
  <div style={{background:"#FAF7F2",border:"1px solid #E0D8CF",borderRadius:10,padding:"16px 18px",marginBottom:10}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:600,color:"#B8956A"}}>Day {idx+1}</span>
        <span style={{fontSize:12,color:"#9E9590"}}>·</span>
        <input value={day.label} onChange={e=>onChange("label",e.target.value)} placeholder="e.g. Rehearsal Dinner" style={{border:"none",background:"transparent",fontSize:14,fontWeight:500,color:"#1C1815",padding:0,width:180}}/>
      </div>
      {total>1&&<button onClick={onRemove} style={{fontSize:11,color:"#C06060",background:"#F8EDED",border:"none",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Remove</button>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 14px"}}>
      <Field label="Date"><input type="date" value={day.date} onChange={e=>onChange("date",e.target.value)}/></Field>
      <Field label="Ceremony / Event Time"><input type="time" value={day.ceremonyTime} onChange={e=>onChange("ceremonyTime",e.target.value)}/></Field>
      <Field label="Ready-by Time">
        <input type="time" value={day.readyBy} onChange={e=>onChange("readyBy",e.target.value)}/>
      </Field>
    </div>
  </div>
);

const Step1 = ({d,set}) => {
  const days=d.days||[{id:"legacy",label:"Wedding Day",date:d.date||"",ceremonyTime:d.ceremonyTime||"",readyBy:d.readyBy||""}];
  const setDay=(idx,k,v)=>{const next=[...days];next[idx]={...next[idx],[k]:v};set("days",next);};
  const addDay=()=>set("days",[...days,blankDay("Day "+(days.length+1))]);
  const removeDay=(idx)=>set("days",days.filter((_,i)=>i!==idx));
  return (
    <div className="fade-up">
      <div style={{textAlign:"center",marginBottom:28}}>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:400,fontStyle:"italic",marginBottom:4}}>The Celebration</h2>
        <p style={{color:"#9E9590",fontSize:14}}>Destination details & timing</p>
      </div>
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E8E0D8",padding:"26px 28px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
          <Field label="Couple's Name" col="1/-1"><input value={d.coupleName} onChange={e=>set("coupleName",e.target.value)} placeholder="e.g. Sofia & Marco"/></Field>
          <Field label="Venue / Estate"><input value={d.venue} onChange={e=>set("venue",e.target.value)} placeholder="e.g. Villa del Balbianello"/></Field>
          <Field label="Destination"><input value={d.location} onChange={e=>set("location",e.target.value)} placeholder="e.g. Lake Como, Italy"/></Field>
          <Field label="Getting Ready Location" col="1/-1"><input value={d.room} onChange={e=>set("room",e.target.value)} placeholder="e.g. Bridal Suite, Grand Hotel"/></Field>
        </div>
        <Divider label="Event Days"/>
        <div style={{fontSize:12,color:"#B0A8A0",marginBottom:14}}>Add each day that needs hair & makeup. Timeline is built per-day from the ready-by time.</div>
        {days.map((day,i)=><DayCard key={day.id} day={day} idx={i} total={days.length} onChange={(k,v)=>setDay(i,k,v)} onRemove={()=>removeDay(i)}/>)}
        <button onClick={addDay} style={{width:"100%",padding:"11px",border:"1.5px dashed #D4C4B4",borderRadius:8,background:"transparent",color:"#A0988E",fontSize:13,cursor:"pointer",fontFamily:"'Jost',sans-serif",marginBottom:16}}>+ Add Another Day</button>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
          <Field label="Photographer"><input value={d.photographer} onChange={e=>set("photographer",e.target.value)} placeholder="Name"/></Field>
          <Field label="Videographer"><input value={d.videographer} onChange={e=>set("videographer",e.target.value)} placeholder="Name"/></Field>
          <Field label="Special Notes" col="1/-1"><textarea value={d.notes} onChange={e=>set("notes",e.target.value)} placeholder="Venue constraints, allergies, access, logistics…"/></Field>
        </div>
        <Divider label="Packing Flags" />
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          <Toggle value={d.isOutdoor} onChange={v=>set("isOutdoor",v)} label="Outdoor ceremony"/>
          <Toggle value={d.hasExtensions} onChange={v=>set("hasExtensions",v)} label="Extensions involved"/>
        </div>
      </div>
    </div>
  );
};

/* ── Step 2: Party Members ──────────────────────────────────────────────── */
const blankM = (dayIds) => ({id:uid(),name:"",role:"bridesmaid",services:"both",stylistId:"",urls:[],notes:"",dayIds:dayIds||[]});

const MemberForm = ({m,stylists,days,onChange,onSave,onRemove}) => {
  const [urlIn,setUrlIn]=useState("");
  const [uploading,setUploading]=useState(false);
  const fileRef=useRef(null);
  const addUrl=()=>{const u=urlIn.trim();if(u&&!m.urls.includes(u)){onChange("urls",[...m.urls,u]);setUrlIn("");}};
  const handleUpload=async(e)=>{
    const files=Array.from(e.target.files||[]);
    if(!files.length) return;
    setUploading(true);
    const newUrls=[];
    for(const file of files){
      const ext=file.name.split(".").pop()||"jpg";
      const path=`${m.id}/${uid()}.${ext}`;
      const {error}=await supabase.storage.from("inspo").upload(path,file,{contentType:file.type});
      if(!error){
        const {data}=supabase.storage.from("inspo").getPublicUrl(path);
        if(data?.publicUrl) newUrls.push(data.publicUrl);
      }
    }
    if(newUrls.length) onChange("urls",[...m.urls,...newUrls]);
    setUploading(false);
    if(fileRef.current) fileRef.current.value="";
  };
  return (
    <div className="fade-in" style={{background:"#FFFCF8",border:"1.5px solid #B8956A",borderRadius:10,padding:"18px 20px",marginBottom:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Field label="Full Name"><input value={m.name} onChange={e=>onChange("name",e.target.value)} placeholder="e.g. Emma Rossi" autoFocus/></Field>
        <Field label="Role"><select value={m.role} onChange={e=>onChange("role",e.target.value)}>{ROLES.map(r=><option key={r.v} value={r.v}>{r.l}</option>)}</select></Field>
        <Field label="Services Needed"><select value={m.services} onChange={e=>onChange("services",e.target.value)}>{SERVICES.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}</select></Field>
        {stylists.length>0&&<Field label="Preferred Stylist"><select value={m.stylistId} onChange={e=>onChange("stylistId",e.target.value)}><option value="">— Auto-assign —</option>{stylists.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
        <Field label="Photo Inspiration" col="1/-1">
          <div style={{display:"flex",gap:8,marginBottom:m.urls.length?10:0}}>
            <input value={urlIn} onChange={e=>setUrlIn(e.target.value)} placeholder="Paste URL or upload photos below" onKeyDown={e=>e.key==="Enter"&&addUrl()} style={{flex:1}}/>
            <Btn size="sm" onClick={addUrl}>Add URL</Btn>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{display:"none"}}/>
            <Btn size="sm" variant="secondary" onClick={()=>fileRef.current?.click()} disabled={uploading}>{uploading?"Uploading…":"Upload"}</Btn>
          </div>
          {m.urls.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{m.urls.map(u=><div key={u} style={{position:"relative"}}><InspoThumb url={u}/><button onClick={()=>onChange("urls",m.urls.filter(x=>x!==u))} style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:"#C06060",color:"#fff",border:"none",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div>)}</div>}
        </Field>
        {days&&days.length>1&&<Field label="Which Days" col="1/-1">
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {days.map(day=>{const on=(m.dayIds||[]).includes(day.id);return(
              <label key={day.id} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer",padding:"6px 12px",borderRadius:6,border:`1.5px solid ${on?"#B8956A":"#E0D8CF"}`,background:on?"#F7EFDF":"#fff",transition:"all .15s"}}>
                <input type="checkbox" checked={on} onChange={()=>{const next=on?(m.dayIds||[]).filter(id=>id!==day.id):[...(m.dayIds||[]),day.id];onChange("dayIds",next);}} style={{display:"none"}}/>
                <span style={{fontWeight:on?500:400,color:on?"#B8956A":"#6B6058"}}>{day.label}{day.date?` · ${new Date(day.date+"T12:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}`:""}</span>
              </label>
            );})}
          </div>
        </Field>}
        <Field label="Notes for Stylist" col="1/-1"><textarea value={m.notes} onChange={e=>onChange("notes",e.target.value)} placeholder="Desired look, hair length & texture, allergies, style preferences…" style={{minHeight:60}}/></Field>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:10,paddingTop:10,borderTop:"1px solid #EDE6DE"}}>
        <Btn variant="ghost" size="sm" onClick={onRemove}>Remove</Btn>
        <Btn size="sm" onClick={onSave} disabled={!m.name.trim()}>Save</Btn>
      </div>
    </div>
  );
};

const MemberCard = ({m,stylists,onEdit,onRemove}) => {
  const ri=getRoleInfo(m.role), sty=stylists.find(s=>s.id===m.stylistId);
  return (
    <div className="fade-in" style={{background:"#fff",border:"1px solid #E8E0D8",borderRadius:10,padding:"13px 17px",display:"flex",gap:13,alignItems:"flex-start",marginBottom:8}}>
      <div style={{width:38,height:38,borderRadius:"50%",background:ri.bg,color:ri.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:600,fontFamily:"'Cormorant Garamond',serif",flexShrink:0}}>{(m.name||"?")[0].toUpperCase()}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:7}}>
          <span style={{fontWeight:500,fontSize:15}}>{m.name||"(Unnamed)"}</span>
          <RolePill role={m.role}/>
          <ServicePill svc={m.services}/>
          {sty&&<span style={{fontSize:11,color:"#9E9590"}}>→ {sty.name}</span>}
        </div>
        {m.urls.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>{m.urls.map(u=><InspoThumb key={u} url={u}/>)}</div>}
        {m.notes&&<p style={{fontSize:12,color:"#6B6058",fontStyle:"italic",lineHeight:1.5}}>{m.notes}</p>}
      </div>
      <div style={{display:"flex",gap:5,flexShrink:0}}>
        <button onClick={onEdit} style={{padding:"5px 11px",background:"#F7EFDF",color:"#B8956A",border:"none",borderRadius:5,fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Edit</button>
        <button onClick={onRemove} style={{padding:"5px 9px",background:"#F8EDED",color:"#C06060",border:"none",borderRadius:5,fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>×</button>
      </div>
    </div>
  );
};

const Step2 = ({members,setMembers,stylists,days}) => {
  const [editing,setEditing]=useState(null);
  const [draft,setDraft]=useState(null);
  const allDayIds=(days||[]).map(d=>d.id);
  const defaultDayIds=allDayIds.length===1?allDayIds:[];
  const startAdd=()=>{const m=blankM(defaultDayIds);setDraft(m);setEditing(m.id);setMembers(p=>[...p,m]);};
  const startEdit=(id)=>{setDraft(members.find(m=>m.id===id));setEditing(id);};
  const changeField=(k,v)=>{const u={...draft,[k]:v};setDraft(u);setMembers(p=>p.map(m=>m.id===editing?u:m));};
  const save=()=>{setEditing(null);setDraft(null);};
  const remove=(id)=>{setMembers(p=>p.filter(m=>m.id!==id));if(editing===id){setEditing(null);setDraft(null);}};
  const hairCt=members.filter(m=>m.services!=="makeup").length;
  const mkupCt=members.filter(m=>m.services!=="hair").length;
  return (
    <div className="fade-up">
      <div style={{textAlign:"center",marginBottom:28}}>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:400,fontStyle:"italic",marginBottom:4}}>The Bridal Party</h2>
        <p style={{color:"#9E9590",fontSize:14}}>Add every person receiving services</p>
      </div>
      {members.length>0&&(
        <div style={{display:"flex",gap:16,marginBottom:18,padding:"13px 17px",background:"#fff",border:"1px solid #E8E0D8",borderRadius:10}}>
          <div style={{textAlign:"center",flex:1}}><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:"#7B9E87"}}>{hairCt}</div><div style={{fontSize:11,color:"#9E9590",letterSpacing:".06em"}}>HAIR</div></div>
          <div style={{width:1,background:"#E8E0D8"}}/>
          <div style={{textAlign:"center",flex:1}}><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:"#C4979A"}}>{mkupCt}</div><div style={{fontSize:11,color:"#9E9590",letterSpacing:".06em"}}>MAKEUP</div></div>
          <div style={{width:1,background:"#E8E0D8"}}/>
          <div style={{textAlign:"center",flex:1}}><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,color:"#B8956A"}}>{members.length}</div><div style={{fontSize:11,color:"#9E9590",letterSpacing:".06em"}}>TOTAL</div></div>
        </div>
      )}
      {members.map(m=>editing===m.id
        ?<MemberForm key={m.id} m={draft} stylists={stylists} days={days} onChange={changeField} onSave={save} onRemove={()=>remove(m.id)}/>
        :<MemberCard key={m.id} m={m} stylists={stylists} onEdit={()=>startEdit(m.id)} onRemove={()=>remove(m.id)}/>
      )}
      {editing===null&&<button onClick={startAdd} style={{width:"100%",padding:"13px",border:"1.5px dashed #D4C4B4",borderRadius:10,background:"transparent",color:"#A0988E",fontSize:14,cursor:"pointer",fontFamily:"'Jost',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:4}}><span style={{fontSize:18,lineHeight:1}}>+</span> Add Party Member</button>}
    </div>
  );
};

/* ── Step 3: Styling Team ───────────────────────────────────────────────── */
const Step3 = ({stylists,setStylists}) => {
  const [adding,setAdding]=useState(false);
  const [newS,setNewS]=useState({id:uid(),name:"",specialty:"both"});
  const [editId,setEditId]=useState(null);
  const addStylist=()=>{if(!newS.name.trim()) return;setStylists(p=>[...p,newS]);setNewS({id:uid(),name:"",specialty:"both"});setAdding(false);};
  return (
    <div className="fade-up">
      <div style={{textAlign:"center",marginBottom:28}}>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:400,fontStyle:"italic",marginBottom:4}}>The Styling Team</h2>
        <p style={{color:"#9E9590",fontSize:14}}>Add all stylists and artists working the day</p>
      </div>
      {stylists.map((s,i)=>(
        <div key={s.id} className="fade-in" style={{background:"#fff",border:"1px solid #E8E0D8",borderRadius:10,padding:"13px 17px",marginBottom:8,display:"flex",alignItems:"center",gap:13}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:STYLIST_PALETTE[i%STYLIST_PALETTE.length]+"22",color:STYLIST_PALETTE[i%STYLIST_PALETTE.length],display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:600,fontFamily:"'Cormorant Garamond',serif",flexShrink:0}}>{(s.name||"?")[0].toUpperCase()}</div>
          <div style={{flex:1}}>
            {editId===s.id
              ?<div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
                <div style={{flex:1}}><input value={s.name} onChange={e=>setStylists(p=>p.map(x=>x.id===s.id?{...x,name:e.target.value}:x))} autoFocus/></div>
                <div style={{flex:1}}><select value={s.specialty} onChange={e=>setStylists(p=>p.map(x=>x.id===s.id?{...x,specialty:e.target.value}:x))}>{SPECIALTIES.map(sp=><option key={sp.v} value={sp.v}>{sp.l}</option>)}</select></div>
                <Btn size="sm" onClick={()=>setEditId(null)}>Done</Btn>
              </div>
              :<><div style={{fontWeight:500,fontSize:15,marginBottom:4}}>{s.name}</div><ServicePill svc={s.specialty}/></>
            }
          </div>
          {editId!==s.id&&<div style={{display:"flex",gap:5}}>
            <button onClick={()=>setEditId(s.id)} style={{padding:"5px 11px",background:"#F7EFDF",color:"#B8956A",border:"none",borderRadius:5,fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Edit</button>
            <button onClick={()=>setStylists(p=>p.filter(x=>x.id!==s.id))} style={{padding:"5px 9px",background:"#F8EDED",color:"#C06060",border:"none",borderRadius:5,fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>×</button>
          </div>}
        </div>
      ))}
      {adding
        ?<div className="fade-in" style={{background:"#FFFCF8",border:"1.5px solid #B8956A",borderRadius:10,padding:"16px 18px",marginBottom:8}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px",marginBottom:12}}>
            <Field label="Name"><input value={newS.name} onChange={e=>setNewS(p=>({...p,name:e.target.value}))} placeholder="Stylist name" autoFocus onKeyDown={e=>e.key==="Enter"&&addStylist()}/></Field>
            <Field label="Specialty"><select value={newS.specialty} onChange={e=>setNewS(p=>({...p,specialty:e.target.value}))}>{SPECIALTIES.map(sp=><option key={sp.v} value={sp.v}>{sp.l}</option>)}</select></Field>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" size="sm" onClick={()=>setAdding(false)}>Cancel</Btn>
            <Btn size="sm" onClick={addStylist} disabled={!newS.name.trim()}>Add Stylist</Btn>
          </div>
        </div>
        :<button onClick={()=>setAdding(true)} style={{width:"100%",padding:"13px",border:"1.5px dashed #D4C4B4",borderRadius:10,background:"transparent",color:"#A0988E",fontSize:14,cursor:"pointer",fontFamily:"'Jost',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><span style={{fontSize:18,lineHeight:1}}>+</span> Add Stylist / Artist</button>
      }
      {!stylists.length&&!adding&&<p style={{textAlign:"center",padding:"16px",color:"#B8B0A8",fontSize:13}}>If no stylists added, the timeline uses a single "Styling Team" track.</p>}
    </div>
  );
};

/* ── Step 4: Timeline ───────────────────────────────────────────────────── */
const GanttBar = ({slots,start,end}) => {
  const total=end-start;
  if (!total||!slots.length) return null;
  return (
    <div style={{position:"relative",height:26,background:"#F0EAE2",borderRadius:4,overflow:"hidden",marginBottom:14}}>
      {slots.map(s=>{
        const left=((s.start-start)/total)*100, width=(s.dur/total)*100;
        const c=s.type==="hair"?"#7B9E87":"#C4979A";
        return <div key={s.memberId+s.type} title={`${s.name} · ${s.type} · ${s.dur}min`} style={{position:"absolute",top:3,height:20,left:`${left}%`,width:`${width}%`,background:c,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",whiteSpace:"nowrap",paddingInline:4}}><span style={{fontSize:10,color:"#fff",fontWeight:500}}>{s.name.split(" ")[0]}</span></div>;
      })}
    </div>
  );
};

const DayTimeline = ({day,members,stylists}) => {
  const dayMembers=members.filter(m=>{
    const ids=m.dayIds||[];
    return ids.length===0||ids.includes(day.id);
  });
  const {tracks,start,end}=useMemo(()=>buildSchedule(dayMembers,stylists,day.readyBy),[dayMembers,stylists,day.readyBy]);
  if(!day.readyBy) return <div style={{textAlign:"center",padding:"30px 20px",color:"#9E9590"}}><p style={{fontSize:13}}>Set a ready-by time for this day in Step 1.</p></div>;
  if(!dayMembers.length) return <div style={{textAlign:"center",padding:"30px 20px",color:"#9E9590"}}><p style={{fontSize:13}}>No party members assigned to this day.</p></div>;
  return (
    <div>
      {start!==null&&<p style={{fontSize:14,color:"#9E9590",textAlign:"center",marginBottom:16}}>Styling begins at <strong style={{color:"#B8956A"}}>{fmtTime(start)}</strong> · Ready by <strong style={{color:"#B8956A"}}>{fmtTime(parseTime(day.readyBy))}</strong></p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        {[{l:"Party Size",v:dayMembers.length,icon:"✦"},{l:"Hair",v:dayMembers.filter(m=>m.services!=="makeup").length,icon:"✦"},{l:"Makeup",v:dayMembers.filter(m=>m.services!=="hair").length,icon:"◆"},{l:"Tracks",v:tracks.length,icon:"✂"}].map(stat=>(
          <div key={stat.l} style={{background:"#fff",border:"1px solid #E8E0D8",borderRadius:10,padding:"13px 10px",textAlign:"center"}}>
            <div style={{color:"#B8956A",fontSize:16,marginBottom:3}}>{stat.icon}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:600,lineHeight:1}}>{stat.v}</div>
            <div style={{fontSize:11,color:"#9E9590",marginTop:3,letterSpacing:".04em"}}>{stat.l}</div>
          </div>
        ))}
      </div>
      {tracks.map((track,ti)=>{
        const accent=STYLIST_PALETTE[ti%STYLIST_PALETTE.length];
        return (
          <div key={track.stylist.id} style={{background:"#fff",border:"1px solid #E8E0D8",borderRadius:12,padding:"18px 22px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:12,borderBottom:"1px solid #E8E0D8"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:accent+"22",color:accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,fontFamily:"'Cormorant Garamond',serif",flexShrink:0}}>{(track.stylist.name||"?")[0].toUpperCase()}</div>
              <div><div style={{fontWeight:500,fontSize:15}}>{track.stylist.name}</div><div style={{fontSize:12,color:"#9E9590"}}>{SPECIALTIES.find(s=>s.v===track.stylist.specialty)?.l}</div></div>
              <div style={{marginLeft:"auto",fontSize:12,color:"#9E9590"}}>{track.slots.length} appointment{track.slots.length!==1?"s":""}</div>
            </div>
            {start!==null&&<GanttBar slots={track.slots} start={start} end={end}/>}
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {track.slots.map(slot=>{
                const tc=TBlock[slot.type];
                return (
                  <div key={slot.memberId+slot.type} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 13px",borderRadius:8,background:tc.bg,border:`1px solid ${tc.border}30`}}>
                    <div style={{minWidth:105,fontFamily:"'Jost',sans-serif",fontSize:13,fontWeight:500,color:tc.text,flexShrink:0}}>{fmtTime(slot.start)}<span style={{color:"#C0B8B0",margin:"0 3px"}}>→</span>{fmtTime(slot.end)}</div>
                    <div style={{width:1,height:26,background:tc.border+"50",flexShrink:0}}/>
                    <div style={{flex:1,display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                      <span style={{fontWeight:500,fontSize:14}}>{slot.name}</span>
                      <RolePill role={slot.role}/>
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:tc.border+"25",color:tc.text,fontWeight:500}}>{slot.type[0].toUpperCase()+slot.type.slice(1)}</span>
                    </div>
                    <div style={{fontSize:12,color:"#9E9590",whiteSpace:"nowrap",flexShrink:0}}>{slot.dur} min</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Step4 = ({members,stylists,details}) => {
  const days=details.days||[{id:"legacy",label:"Wedding Day",date:details.date||"",ceremonyTime:details.ceremonyTime||"",readyBy:details.readyBy||""}];
  const [activeDay,setActiveDay]=useState(days[0]?.id);
  const [copied,setCopied]=useState(false);
  const fallback=(t)=>{const ta=document.createElement("textarea");ta.value=t;ta.style.cssText="position:fixed;top:0;left:0;opacity:0;";document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand("copy");setCopied(true);setTimeout(()=>setCopied(false),2200);}catch(e){}document.body.removeChild(ta);};
  const copyText=()=>{
    const lines=[`✦ ${details.coupleName||"Wedding"} — Hair & Makeup Timeline`,(details.venue||details.location)&&`📍 ${[details.venue,details.location].filter(Boolean).join(", ")}`,details.room&&`🏨 ${details.room}`,""].filter(v=>v!==false&&v!==undefined&&v!=="");
    days.forEach(day=>{
      const dayMembers=members.filter(m=>{const ids=m.dayIds||[];return ids.length===0||ids.includes(day.id);});
      const {tracks,start}=buildSchedule(dayMembers,stylists,day.readyBy);
      if(days.length>1) lines.push(`━━ ${day.label}${day.date?` · ${fmtDate(day.date)}`:""}  ━━`);
      else if(day.date) lines.push(`📅 ${new Date(day.date+"T12:00").toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}`);
      if(day.readyBy) lines.push(`⏰ Ready by: ${fmtTime(parseTime(day.readyBy))}`);
      if(start!==null) lines.push(`⏳ Styling begins: ${fmtTime(start)}`);
      lines.push("");
      tracks.forEach(t=>{lines.push(`— ${t.stylist.name} · ${SPECIALTIES.find(s=>s.v===t.stylist.specialty)?.l||""} —`);t.slots.forEach(s=>lines.push(`  ${fmtTime(s.start)} → ${fmtTime(s.end)}  ${s.name} · ${s.type[0].toUpperCase()+s.type.slice(1)} (${s.dur} min)`));lines.push("");});
    });
    if(details.notes) lines.push(`📝 ${details.notes}`);
    const text=lines.join("\n");
    try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2200);}).catch(()=>fallback(text));}else{fallback(text);}}catch(e){fallback(text);}
  };
  if (!members.length) return <div style={{textAlign:"center",padding:"60px 20px",color:"#9E9590"}}><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:60,color:"#E0D8CF",marginBottom:12}}>✦</div><p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontStyle:"italic",marginBottom:8}}>No party members yet</p><p style={{fontSize:14}}>Add your bridal party in Step 2.</p></div>;
  const currentDay=days.find(d=>d.id===activeDay)||days[0];
  return (
    <div className="fade-up">
      <div style={{textAlign:"center",marginBottom:22}}>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:400,fontStyle:"italic",marginBottom:4}}>The Timeline</h2>
      </div>
      {days.length>1&&<div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:22}}>
        {days.map(day=>(
          <button key={day.id} onClick={()=>setActiveDay(day.id)} style={{fontFamily:"'Jost',sans-serif",fontSize:12,letterSpacing:".06em",color:activeDay===day.id?"#fff":"#6B6058",background:activeDay===day.id?"#1C1815":"#fff",border:`1px solid ${activeDay===day.id?"#1C1815":"#E0D8CF"}`,borderRadius:20,padding:"8px 16px",cursor:"pointer",transition:"all .15s"}}>
            {day.label}{day.date?` · ${new Date(day.date+"T12:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}`:""}
          </button>
        ))}
      </div>}
      <DayTimeline day={currentDay} members={members} stylists={stylists}/>
      <Divider label="Client Reference Cards"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12,marginBottom:26}}>
        {members.map(m=>{
          const ri=getRoleInfo(m.role);
          return (
            <div key={m.id} style={{background:"#fff",border:"1px solid #E8E0D8",borderRadius:10,padding:"14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:ri.bg,color:ri.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,fontFamily:"'Cormorant Garamond',serif",flexShrink:0}}>{(m.name||"?")[0].toUpperCase()}</div>
                <div><div style={{fontWeight:500,fontSize:14}}>{m.name||"(Unnamed)"}</div><div style={{marginTop:3}}><RolePill role={m.role}/></div></div>
              </div>
              <ServicePill svc={m.services}/>
              {m.urls.length>0&&<div style={{display:"flex",gap:5,marginTop:10,flexWrap:"wrap"}}>{m.urls.map(u=><InspoThumb key={u} url={u}/>)}</div>}
              {m.notes&&<p style={{marginTop:9,fontSize:12,color:"#6B6058",fontStyle:"italic",lineHeight:1.5,padding:"8px 10px",background:"#FAF7F2",borderRadius:6}}>{m.notes}</p>}
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",justifyContent:"center"}}><Btn onClick={copyText} variant="secondary">{copied?"✓ Copied!":"📋 Copy Timeline Text"}</Btn></div>
    </div>
  );
};

/* ── Step 5: Packing List ───────────────────────────────────────────────── */
const Step5 = ({members,details,packState,setPackState}) => {
  const {checked={},smartChecked={},customItems={},collapsed={}} = packState;
  const [newItemText,setNewItemText]=useState({});
  const [copied,setCopied]=useState(false);
  const suggestions=useMemo(()=>getSmartSuggestions(members,details),[members,details]);
  const set=(k,fn)=>setPackState(p=>({...p,[k]:fn(p[k]||{})}));
  const toggleItem=(catId,item)=>set("checked",p=>({...p,[`${catId}::${item}`]:!p[`${catId}::${item}`]}));
  const toggleSmart=(i)=>set("smartChecked",p=>({...p,[i]:!p[i]}));
  const toggleCollapse=(catId)=>set("collapsed",p=>({...p,[catId]:!p[catId]}));
  const addCustom=(catId)=>{
    const text=(newItemText[catId]||"").trim(); if(!text) return;
    set("customItems",p=>({...p,[catId]:[...(p[catId]||[]),text]}));
    setNewItemText(p=>({...p,[catId]:""}));
  };
  const removeCustom=(catId,idx)=>set("customItems",p=>({...p,[catId]:p[catId].filter((_,i)=>i!==idx)}));
  const totalItems=PACKING_MASTER.reduce((acc,cat)=>acc+cat.items.length+(customItems[cat.id]?.length||0),0)+suggestions.length;
  const checkedCount=Object.values(checked).filter(Boolean).length+Object.values(smartChecked).filter(Boolean).length;
  const progress=totalItems>0?Math.round((checkedCount/totalItems)*100):0;
  const fallback=(t)=>{const ta=document.createElement("textarea");ta.value=t;ta.style.cssText="position:fixed;top:0;left:0;opacity:0;";document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand("copy");setCopied(true);setTimeout(()=>setCopied(false),2200);}catch(e){}document.body.removeChild(ta);};
  const exportText=()=>{
    const lines=[`✦ ${details.coupleName||"Wedding"} — Team Packing List`,details.date&&`📅 ${fmtDate(details.date)}`,``].filter(v=>v!==false&&v!==undefined);
    if(suggestions.length){lines.push("— EVENT-SPECIFIC ADDITIONS —");suggestions.forEach((s,i)=>lines.push(`${smartChecked[i]?"☑":"☐"} [${s.cat}] ${s.text}`));lines.push("");}
    PACKING_MASTER.forEach(cat=>{lines.push(`— ${cat.label.toUpperCase()} —`);[...cat.items,...(customItems[cat.id]||[])].forEach(item=>lines.push(`${checked[`${cat.id}::${item}`]?"☑":"☐"} ${item}`));lines.push("");});
    const text=lines.join("\n");
    try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2200);}).catch(()=>fallback(text));}else{fallback(text);}}catch(e){fallback(text);}
  };
  return (
    <div className="fade-up">
      <div style={{textAlign:"center",marginBottom:22}}>
        <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:400,fontStyle:"italic",marginBottom:4}}>Team Packing List</h2>
        <p style={{color:"#9E9590",fontSize:14}}>Salon use only · auto-generated from this event</p>
      </div>
      {/* Progress */}
      <div style={{background:"#fff",border:"1px solid #E8E0D8",borderRadius:10,padding:"14px 20px",marginBottom:18,display:"flex",alignItems:"center",gap:16}}>
        <div style={{flex:1,height:6,background:"#F0EAE2",borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${progress}%`,background:"#B8956A",borderRadius:3,transition:"width .4s ease"}}/>
        </div>
        <span style={{fontSize:13,color:"#9E9590",whiteSpace:"nowrap"}}>{checkedCount}/{totalItems} packed</span>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:"#B8956A",lineHeight:1}}>{progress}%</span>
      </div>
      {/* Smart suggestions */}
      {suggestions.length>0&&(
        <div style={{background:"#F7EFDF",border:"1px solid #E8D5B0",borderRadius:12,padding:"16px 20px",marginBottom:14}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,color:"#1C1815",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:"#B8956A"}}>◈</span> Event-Specific Additions
            <span style={{fontFamily:"'Jost',sans-serif",fontSize:10,color:"#A0988E",letterSpacing:".1em",textTransform:"uppercase"}}>auto</span>
          </div>
          {suggestions.map((s,i)=>(
            <div key={i} className="check-row" onClick={()=>toggleSmart(i)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:7,cursor:"pointer",marginBottom:3,background:"transparent",transition:"background .12s"}}>
              <div style={{width:18,height:18,borderRadius:4,border:`1.5px solid ${smartChecked[i]?"#B8956A":"#E0D8CF"}`,background:smartChecked[i]?"#B8956A":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                {smartChecked[i]&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
              </div>
              <span style={{fontSize:13,color:smartChecked[i]?"#B8B0A8":"#1C1815",textDecoration:smartChecked[i]?"line-through":"none",flex:1,transition:"all .15s"}}>{s.text}</span>
              <span style={{fontSize:10,color:"#B0A8A0",letterSpacing:".06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{s.cat}</span>
            </div>
          ))}
        </div>
      )}
      {/* Master list */}
      {PACKING_MASTER.map(cat=>{
        const allItems=[...cat.items,...(customItems[cat.id]||[])];
        const catChecked=allItems.filter(item=>checked[`${cat.id}::${item}`]).length;
        const isCollapsed=collapsed[cat.id];
        return (
          <div key={cat.id} style={{background:"#fff",border:"1px solid #E8E0D8",borderRadius:10,marginBottom:8,overflow:"hidden"}}>
            <div onClick={()=>toggleCollapse(cat.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",cursor:"pointer",transition:"background .12s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#F7F2EC"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <span style={{color:"#B8956A",fontSize:13}}>{cat.icon}</span>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,color:"#1C1815"}}>{cat.label}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <span style={{fontSize:12,color:catChecked===allItems.length&&allItems.length>0?"#7B9E87":"#A0988E"}}>{catChecked}/{allItems.length}</span>
                <span style={{color:"#C0B8B0",fontSize:11,display:"inline-block",transform:isCollapsed?"rotate(-90deg)":"none",transition:"transform .2s"}}>▾</span>
              </div>
            </div>
            {!isCollapsed&&<div style={{borderTop:"1px solid #E8E0D8"}}>
              {cat.items.map((item,idx)=>{
                const key=`${cat.id}::${item}`, isChecked=checked[key];
                return (
                  <div key={idx} className="check-row" onClick={()=>toggleItem(cat.id,item)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 18px",cursor:"pointer",background:"transparent",transition:"background .12s",borderBottom:"1px solid #F0EAE250"}}>
                    <div style={{width:17,height:17,borderRadius:4,border:`1.5px solid ${isChecked?"#7B9E87":"#E0D8CF"}`,background:isChecked?"#7B9E87":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                      {isChecked&&<span style={{color:"#fff",fontSize:9}}>✓</span>}
                    </div>
                    <span style={{fontSize:13,color:isChecked?"#B8B0A8":"#4A4038",textDecoration:isChecked?"line-through":"none",transition:"all .15s"}}>{item}</span>
                  </div>
                );
              })}
              {(customItems[cat.id]||[]).map((item,idx)=>{
                const key=`${cat.id}::${item}`, isChecked=checked[key];
                return (
                  <div key={`c${idx}`} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 18px",background:"#FFFCF850",borderBottom:"1px solid #F0EAE250"}}>
                    <div onClick={()=>toggleItem(cat.id,item)} style={{width:17,height:17,borderRadius:4,border:`1.5px solid ${isChecked?"#7B9E87":"#E0D8CF"}`,background:isChecked?"#7B9E87":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all .15s"}}>
                      {isChecked&&<span style={{color:"#fff",fontSize:9}}>✓</span>}
                    </div>
                    <span onClick={()=>toggleItem(cat.id,item)} style={{fontSize:13,color:isChecked?"#B8B0A8":"#4A4038",textDecoration:isChecked?"line-through":"none",flex:1,cursor:"pointer"}}>{item}</span>
                    <button onClick={()=>removeCustom(cat.id,idx)} style={{background:"none",border:"none",color:"#C0B8B0",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>×</button>
                  </div>
                );
              })}
              <div style={{display:"flex",gap:8,padding:"9px 18px",background:"#F7F2EC"}}>
                <input type="text" value={newItemText[cat.id]||""} onChange={e=>setNewItemText(p=>({...p,[cat.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addCustom(cat.id)} placeholder="Add custom item…" style={{flex:1,fontSize:13,padding:"6px 10px"}}/>
                <Btn size="sm" onClick={()=>addCustom(cat.id)} variant="ghost">+ Add</Btn>
              </div>
            </div>}
          </div>
        );
      })}
      <div style={{display:"flex",gap:10,marginTop:18,justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={()=>setPackState(p=>({...p,checked:{},smartChecked:{}}))} style={{fontFamily:"'Jost',sans-serif",fontSize:12,letterSpacing:".08em",textTransform:"uppercase",color:"#A0988E",background:"none",border:"1px solid #E0D8CF",borderRadius:6,padding:"9px 16px",cursor:"pointer"}}>Reset Checks</button>
        <Btn onClick={exportText} variant="secondary">{copied?"✓ Copied!":"📋 Copy Packing List"}</Btn>
      </div>
    </div>
  );
};

/* ── Landing Page ───────────────────────────────────────────────────────── */
const STATUS_STYLE = {
  confirmed: {color:"#4A7A5A",bg:"#EBF2ED"},
  pending:   {color:"#9A7548",bg:"#F7EFDF"},
  complete:  {color:"#7B8FA0",bg:"#EAF0F5"},
};

const EventCard = ({ev,onClick}) => {
  const evDays=ev.details.days||[];
  const firstDate=evDays[0]?.date||ev.details.date||"";
  const countdown=daysUntil(firstDate);
  const st=STATUS_STYLE[ev.status]||STATUS_STYLE.pending;
  const hairCt=ev.members.filter(m=>m.services!=="makeup").length;
  const mkupCt=ev.members.filter(m=>m.services!=="hair").length;
  const dateStr=evDays.length>1
    ?evDays.filter(d=>d.date).map(d=>new Date(d.date+"T12:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})).join(" – ")
    :fmtDate(firstDate);
  return (
    <div className="ev-card" onClick={onClick} style={{background:"#fff",border:"1px solid #E8E0D8",borderRadius:12,padding:"18px 22px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:"#1C1815",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.details.coupleName||"Unnamed Event"}</span>
          <span style={{fontSize:10,letterSpacing:".1em",textTransform:"uppercase",color:st.color,background:st.bg,borderRadius:20,padding:"2px 9px",flexShrink:0,fontWeight:500}}>{ev.status}</span>
        </div>
        <div style={{fontSize:12,color:"#9E9590",marginBottom:8}}>{dateStr}{ev.details.venue?` · ${ev.details.venue}`:""}{ev.details.location?`, ${ev.details.location}`:""}{evDays.length>1?` · ${evDays.length} days`:""}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {ev.members.length>0&&<span style={{fontSize:11,color:"#9E9590",background:"#F0EAE2",borderRadius:20,padding:"2px 9px"}}>{ev.members.length} {ev.members.length===1?"person":"people"}</span>}
          {hairCt>0&&<span style={{fontSize:11,color:"#4A7A5A",background:"#EBF2ED",borderRadius:20,padding:"2px 9px"}}>{hairCt} hair</span>}
          {mkupCt>0&&<span style={{fontSize:11,color:"#8B4A55",background:"#F8EDED",borderRadius:20,padding:"2px 9px"}}>{mkupCt} makeup</span>}
          {ev.details.isOutdoor&&<span style={{fontSize:11,color:"#7B6050",background:"#F5EFEA",borderRadius:20,padding:"2px 9px"}}>outdoor</span>}
          {ev.details.hasExtensions&&<span style={{fontSize:11,color:"#7B6050",background:"#F5EFEA",borderRadius:20,padding:"2px 9px"}}>extensions</span>}
        </div>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        {countdown!==null&&countdown>=0
          ?<><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,color:countdown<=14?"#C4979A":"#B8956A",lineHeight:1}}>{countdown}</div><div style={{fontSize:10,color:"#A0988E",letterSpacing:".08em",textTransform:"uppercase"}}>{countdown===1?"day":"days"} out</div></>
          :<><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:"#C0B8B0"}}>✓</div><div style={{fontSize:10,color:"#C0B8B0",letterSpacing:".08em",textTransform:"uppercase"}}>passed</div></>
        }
      </div>
    </div>
  );
};

const blankDay = (label="Wedding Day") => ({id:uid(),label,date:"",ceremonyTime:"",readyBy:""});

const blankEvent = () => ({
  id: uid(),
  status: "pending",
  details: {coupleName:"",venue:"",location:"",room:"",photographer:"",videographer:"",notes:"",isOutdoor:false,hasExtensions:false,days:[blankDay()]},
  members: [],
  stylists: [],
  packState: {},
  lastStep: 1,
});

const Landing = ({events,onOpen,onNew}) => {
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("upcoming");
  const sorted=[...events]
    .filter(e=>!search||(e.details.coupleName||"").toLowerCase().includes(search.toLowerCase())||(e.details.venue||"").toLowerCase().includes(search.toLowerCase()))
    .filter(e=>{const fd=(e.details.days||[])[0]?.date||e.details.date||"";const d=daysUntil(fd);if(filter==="upcoming") return d===null||d>=0;if(filter==="past") return d!==null&&d<0;return true;})
    .sort((a,b)=>{const da=new Date((a.details.days||[])[0]?.date||a.details.date||"9999"),db=new Date((b.details.days||[])[0]?.date||b.details.date||"9999");return da-db;});
  return (
    <div style={{minHeight:"100vh",background:"#FAF7F2",paddingBottom:60}}>
      <div style={{background:"#1C1815",padding:"20px 32px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:"#D4B896",letterSpacing:".14em"}}>FLOWE</div>
          <div style={{fontSize:10,color:"#6B6058",letterSpacing:".18em",textTransform:"uppercase",marginTop:1}}>Bridal Beauty Planner</div>
        </div>
        <Btn onClick={onNew}>+ New Event</Btn>
      </div>
      <div style={{maxWidth:720,margin:"0 auto",padding:"28px 16px"}}>
        <div style={{display:"flex",gap:10,marginBottom:22,alignItems:"center"}}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search couple or venue…" style={{flex:1,padding:"9px 14px"}}/>
          {["upcoming","past","all"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{fontFamily:"'Jost',sans-serif",fontSize:11,letterSpacing:".08em",textTransform:"uppercase",color:filter===f?"#fff":"#A0988E",background:filter===f?"#1C1815":"#fff",border:`1px solid ${filter===f?"#1C1815":"#E0D8CF"}`,borderRadius:20,padding:"7px 14px",cursor:"pointer",transition:"all .15s",whiteSpace:"nowrap"}}>{f}</button>
          ))}
        </div>
        {sorted.length===0
          ?<div style={{textAlign:"center",padding:"60px 20px",color:"#9E9590"}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:52,color:"#E8E0D8",marginBottom:12}}>✦</div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontStyle:"italic",marginBottom:8}}>No events yet</p>
            <p style={{fontSize:13,marginBottom:20}}>Create your first event to get started.</p>
            <Btn onClick={onNew}>+ New Event</Btn>
          </div>
          :<div style={{display:"flex",flexDirection:"column",gap:10}}>{sorted.map(ev=><EventCard key={ev.id} ev={ev} onClick={()=>onOpen(ev.id)}/>)}</div>
        }
      </div>
    </div>
  );
};

/* ── Root App ───────────────────────────────────────────────────────────── */
const STEP_LABELS=["Continue to Party →","Continue to Team →","Generate Timeline →","View Packing List →"];

/* ── Supabase helpers ──────────────────────────────────────────────────── */
const toRow = (ev) => ({
  id: ev.id,
  status: ev.status,
  details: ev.details,
  members: ev.members,
  stylists: ev.stylists,
  pack_state: ev.packState,
  last_step: ev.lastStep,
  updated_at: new Date().toISOString(),
});
const fromRow = (r) => ({
  id: r.id,
  status: r.status,
  details: r.details || {},
  members: r.members || [],
  stylists: r.stylists || [],
  packState: r.pack_state || {},
  lastStep: r.last_step || 1,
});

/* ── Share Button ──────────────────────────────────────────────────────── */
const ShareBtn = ({eventId, coupleName}) => {
  const [open,setOpen]=useState(false);
  const [copied,setCopied]=useState(false);
  const url=`${window.location.origin}?client=${eventId}`;
  const msg=`Hi${coupleName?` ${coupleName}`:""}! Please fill out your beauty details for your upcoming event: ${url}`;

  const handleShare=()=>{
    if(navigator.share){
      navigator.share({title:"FLOWE Beauty Planner",text:msg,url}).catch(()=>{});
    } else {
      setOpen(o=>!o);
    }
  };
  const copy=()=>{navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const sms=()=>{window.open(`sms:?&body=${encodeURIComponent(msg)}`);setOpen(false);};
  const email=()=>{window.open(`mailto:?subject=${encodeURIComponent("Your Beauty Planner Form — FLOWE")}&body=${encodeURIComponent(msg)}`);setOpen(false);};

  return (
    <div style={{position:"relative"}}>
      <button onClick={handleShare} style={{fontFamily:"'Jost',sans-serif",fontSize:10,color:"#fff",background:"#B8956A",border:"none",borderRadius:5,padding:"5px 12px",cursor:"pointer",letterSpacing:".06em",whiteSpace:"nowrap",fontWeight:500}}>Send to Client</button>
      {open&&<div className="fade-in" style={{position:"absolute",top:"100%",right:0,marginTop:8,background:"#fff",border:"1px solid #E0D8CF",borderRadius:10,boxShadow:"0 6px 24px rgba(0,0,0,.1)",padding:6,zIndex:100,minWidth:180,display:"flex",flexDirection:"column",gap:2}}>
        <button onClick={sms} style={{fontFamily:"'Jost',sans-serif",fontSize:13,color:"#1C1815",background:"transparent",border:"none",borderRadius:6,padding:"10px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>💬</span> Text Message
        </button>
        <button onClick={email} style={{fontFamily:"'Jost',sans-serif",fontSize:13,color:"#1C1815",background:"transparent",border:"none",borderRadius:6,padding:"10px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>✉️</span> Email
        </button>
        <button onClick={()=>{copy();setOpen(false);}} style={{fontFamily:"'Jost',sans-serif",fontSize:13,color:"#1C1815",background:"transparent",border:"none",borderRadius:6,padding:"10px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>🔗</span> {copied?"Copied!":"Copy Link"}
        </button>
        <div style={{height:1,background:"#E8E0D8",margin:"2px 8px"}}/>
        <button onClick={()=>setOpen(false)} style={{fontFamily:"'Jost',sans-serif",fontSize:12,color:"#A0988E",background:"transparent",border:"none",padding:"6px 14px",cursor:"pointer",textAlign:"center"}}>Cancel</button>
      </div>}
      {open&&<div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:99}}/>}
    </div>
  );
};

const CLIENT_STEPS=[{n:1,l:"Event"},{n:2,l:"Party"}];

const ClientView = ({event,updateEvent}) => {
  const [step,setStep]=useState(event?.lastStep>2?1:event?.lastStep||1);
  const [saved,setSaved]=useState(false);
  if(!event) return <div style={{minHeight:"100vh",background:"#FAF7F2",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Jost',sans-serif",color:"#9E9590"}}>Event not found.</div>;
  const details=event.details||{};
  const setDetails=(k,v)=>{updateEvent(event.id,e=>({...e,details:{...e.details,[k]:v}}));setSaved(false);};
  const members=event.members||[];
  const setMembers=(fn)=>{updateEvent(event.id,e=>({...e,members:typeof fn==="function"?fn(e.members):fn}));setSaved(false);};
  const stylists=event.stylists||[];
  return (
    <div style={{minHeight:"100vh",background:"#FAF7F2",paddingBottom:60}}>
      <div style={{background:"#1C1815",padding:"17px 32px",marginBottom:36,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:"#D4B896",letterSpacing:".14em"}}>FLOWE</div>
          <div style={{fontSize:10,color:"#6B6058",letterSpacing:".18em",textTransform:"uppercase",marginTop:1}}>Bridal Beauty Planner</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {details.coupleName&&<span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:"#D4B896",fontStyle:"italic"}}>{details.coupleName}</span>}
        </div>
      </div>
      <div style={{maxWidth:720,margin:"0 auto",padding:"0 16px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0,marginBottom:36}}>
          {CLIENT_STEPS.map((s,i)=>(
            <div key={s.n} style={{display:"flex",alignItems:"center"}}>
              <div onClick={()=>setStep(s.n)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer"}}>
                <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:step===s.n?"#B8956A":step>s.n?"#7B9E87":"#E8E0D8",color:step>=s.n?"#fff":"#A0988E",fontSize:11,fontWeight:600,transition:"all .3s",boxShadow:step===s.n?"0 4px 14px rgba(184,149,106,.35)":"none"}}>{step>s.n?"✓":s.n}</div>
                <span style={{fontSize:10,letterSpacing:".08em",textTransform:"uppercase",color:step===s.n?"#B8956A":"#A0988E",fontWeight:step===s.n?500:400}}>{s.l}</span>
              </div>
              {i<CLIENT_STEPS.length-1&&<div style={{width:36,height:1.5,background:step>s.n?"#7B9E87":"#E8E0D8",marginBottom:22,transition:"background .3s"}}/>}
            </div>
          ))}
        </div>
        {step===1&&<Step1 d={details} set={setDetails}/>}
        {step===2&&<Step2 members={members} setMembers={setMembers} stylists={stylists} days={details.days}/>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:26}}>
          {step>1?<Btn variant="ghost" onClick={()=>setStep(1)}>← Back</Btn>:<div/>}
          {step===1&&<Btn onClick={()=>setStep(2)}>Continue to Party →</Btn>}
          {step===2&&<Btn onClick={()=>setSaved(true)} variant={saved?"ghost":"primary"}>{saved?"✓ Saved":"Submit"}</Btn>}
        </div>
        {saved&&<div className="fade-up" style={{textAlign:"center",marginTop:20,padding:"16px 20px",background:"#EBF2ED",borderRadius:10,color:"#3A6B4C",fontSize:13}}>Thank you! Your details have been saved. Your stylist will review them shortly.</div>}
      </div>
    </div>
  );
};

export default function App() {
  const [events,setEvents]=useState([]);
  const [openId,setOpenId]=useState(null);
  const saveTimer=useRef(null);
  const [clientMode,setClientMode]=useState(null);

  // Detect client mode from URL
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const cid=params.get("client");
    if(cid) setClientMode(cid);
  },[]);

  // Load events from Supabase on mount
  useEffect(()=>{
    if(clientMode){
      supabase.from("events").select("*").eq("id",clientMode).single()
        .then(({data,error})=>{
          if(!error&&data) setEvents([fromRow(data)]);
        });
    } else {
      supabase.from("events").select("*").order("created_at",{ascending:false})
        .then(({data,error})=>{
          if(!error&&data) setEvents(data.map(fromRow));
        });
    }
  },[clientMode]);

  // Debounced save to Supabase whenever events change
  const saveEvent = useCallback((ev)=>{
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      supabase.from("events").upsert(toRow(ev)).then(({error})=>{
        if(error) console.error("Save error:",error);
      });
    },500);
  },[]);

  const openEvent=events.find(e=>e.id===openId);
  const updateEvent=(id,fn)=>{
    setEvents(p=>{
      const next=p.map(e=>e.id===id?fn(e):e);
      const updated=next.find(e=>e.id===id);
      if(updated) saveEvent(updated);
      return next;
    });
  };

  const createAndOpen=()=>{
    const ev=blankEvent();
    setEvents(p=>[...p,ev]);
    supabase.from("events").insert(toRow(ev));
    setOpenId(ev.id);
  };

  const step=openEvent?.lastStep||1;
  const setStep=(s)=>updateEvent(openId,e=>({...e,lastStep:typeof s==="function"?s(e.lastStep||1):s}));
  const details=openEvent?.details||{};
  const setDetails=(k,v)=>updateEvent(openId,e=>({...e,details:{...e.details,[k]:v}}));
  const members=openEvent?.members||[];
  const setMembers=(fn)=>updateEvent(openId,e=>({...e,members:typeof fn==="function"?fn(e.members):fn}));
  const stylists=openEvent?.stylists||[];
  const setStylists=(fn)=>updateEvent(openId,e=>({...e,stylists:typeof fn==="function"?fn(e.stylists):fn}));
  const packState=openEvent?.packState||{};
  const setPackState=(fn)=>updateEvent(openId,e=>({...e,packState:typeof fn==="function"?fn(e.packState):fn}));

  // Client mode — only steps 1 & 2
  if (clientMode) {
    const clientEvent=events.find(e=>e.id===clientMode);
    return <ClientView event={clientEvent} updateEvent={updateEvent}/>;
  }

  if (!openId) return <Landing events={events} onOpen={setOpenId} onNew={createAndOpen}/>;

  return (
    <div style={{minHeight:"100vh",background:"#FAF7F2",paddingBottom:60}}>
      <div style={{background:"#1C1815",padding:"17px 32px",marginBottom:36,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <button onClick={()=>setOpenId(null)} style={{background:"none",border:"none",color:"#6B6058",cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:11,letterSpacing:".12em",textTransform:"uppercase",padding:0,display:"flex",alignItems:"center",gap:5}}>← Events</button>
          <div style={{width:1,height:20,background:"#3A3028"}}/>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:"#D4B896",letterSpacing:".14em"}}>FLOWE</div>
            <div style={{fontSize:10,color:"#6B6058",letterSpacing:".18em",textTransform:"uppercase",marginTop:1}}>Bridal Beauty Planner</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {details.coupleName&&<span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:"#D4B896",fontStyle:"italic"}}>{details.coupleName}</span>}
          {(details.days||[]).filter(d=>d.date).map((d,i)=><span key={i} style={{fontSize:12,color:"#6B6058"}}>{new Date(d.date+"T12:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>)}
          <ShareBtn eventId={openId} coupleName={details.coupleName}/>
          <select value={openEvent?.status||"pending"} onChange={e=>updateEvent(openId,ev=>({...ev,status:e.target.value}))}
            style={{fontFamily:"'Jost',sans-serif",fontSize:11,color:"#D4B896",background:"transparent",border:"1px solid #3A3028",borderRadius:5,padding:"4px 8px",width:"auto",letterSpacing:".06em"}}>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="complete">Complete</option>
          </select>
        </div>
      </div>
      <div style={{maxWidth:720,margin:"0 auto",padding:"0 16px"}}>
        <StepNav step={step} setStep={setStep}/>
        {step===1&&<Step1 d={details} set={setDetails}/>}
        {step===2&&<Step2 members={members} setMembers={setMembers} stylists={stylists} days={details.days}/>}
        {step===3&&<Step3 stylists={stylists} setStylists={setStylists}/>}
        {step===4&&<Step4 members={members} stylists={stylists} details={details}/>}
        {step===5&&<Step5 members={members} details={details} packState={packState} setPackState={setPackState}/>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:26}}>
          {step>1?<Btn variant="ghost" onClick={()=>setStep(s=>s-1)}>← Back</Btn>:<div/>}
          {step<5&&<Btn onClick={()=>setStep(s=>s+1)}>{STEP_LABELS[step-1]}</Btn>}
        </div>
      </div>
    </div>
  );
}
