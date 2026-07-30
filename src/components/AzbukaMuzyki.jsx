"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ─── ТЕМА (бренд: чёрный + терракота + белый) ────────────────────────────────
const T = {
  bg:          "#F8F6F3",
  nav:         "#FFFFFF",   // белая шапка под логотип
  navBorder:   "#E6E2DD",
  primary:     "#1A1A1A",
  primaryLight:"#EEEBE8",
  accent:      "#C94A2A",
  accentLight: "#FBF0EC",
  surface:     "#FFFFFF",
  border:      "#E6E2DD",
  textMain:    "#1A1A1A",
  textSub:     "#9A9490",
  success:     "#2D7A4F",
  successBg:   "#E6F4ED",
  warning:     "#B87820",
  warningBg:   "#FBF3E0",
  danger:      "#C13A2A",
  dangerBg:    "#FBEBE8",
  muted:       "#F5F2EF",
};

const TC = {
  1:{ bg:"#EBEBEB",  text:"#1A1A1A", dot:"#1A1A1A" },
  2:{ bg:"#FBF0EC",  text:"#C94A2A", dot:"#C94A2A" },
  3:{ bg:"#F5F0E8",  text:"#8B6B3D", dot:"#A07840" },
  4:{ bg:"#ECEAE8",  text:"#5C5450", dot:"#7A7470" },
};
const teacherColor = (id) => TC[id] || TC[1];

const SUB_TYPES = [
  { key:"trial",      label:"Пробное занятие",           lessons:1, price:1000 },
  { key:"single",     label:"Разовое занятие",            lessons:1, price:2100 },
  { key:"ind_4",      label:"4 занятия (индивидуально)",  lessons:4, price:7000 },
  { key:"ind_8",      label:"8 занятий (индивидуально)",  lessons:8, price:12800 },
  { key:"ensemble_4", label:"4 занятия (ансамбль)",       lessons:4, price:3500 },
  { key:"tandem_4",   label:"4 занятия (тандем)",         lessons:4, price:11500 },
];
const DIRECTIONS   = ["Вокал", "Фортепиано", "Барабаны", "Гитара", "Скрипка"];
const MESSENGERS   = ["Telegram","VK/Макс","SMS"];
const EXPENSE_CATS = ["Аренда","Налоги","Уборка","Реклама","Оборудование","Прочее"];
const ROLE_OPTIONS = [
  {value:"admin",   label:"Администратор"},
  {value:"teacher", label:"Педагог"},
];
const ROLE_LABELS = {admin:"Администратор", teacher:"Педагог"};
const TEACHER_RATE = 800;
const TRIAL_TEACHER_RATE = 500;
const WEEK_DAYS    = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
const MONTH_NAMES  = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

const today     = (() => { const d = new Date(); d.setHours(12,0,0,0); return d; })();
const todayStr  = today.toISOString().split("T")[0];
const addDays   = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const addMonths = (d,n) => { const r=new Date(d); r.setMonth(r.getMonth()+n); return r; };
const toDateStr = (d) => new Date(d).toISOString().split("T")[0];
const fmtDate   = (s) => s ? new Date(s).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
const fmtMoney  = (n) => n.toLocaleString("ru-RU") + " ₽";
const fmtTime   = (s) => s ? s.slice(11,16) : "";
const messengerEmoji = (m) => ({Telegram:"✈️","VK/Макс":"💬",SMS:"📱"}[m]||"📩");
const statusMeta = (s) => ({
  planned:     {label:"Запланировано", color:"muted"},
  attended:    {label:"Посетил",       color:"success"},
  missed:      {label:"Пропуск",       color:"danger"},
  rescheduled: {label:"Перенос",       color:"warning"},
  sick:        {label:"По справке",    color:"muted"},
}[s]||{label:s,color:"muted"});
const subAlert = (sub) => {
  if (sub.status !== "active") return "none";
  if (sub.lessonsLeft <= 1)    return "danger";
  if (sub.lessonsLeft <= 2)    return "warning";
  return "none";
};
const subDateExpired = (sub) =>
  sub.status === "active" && sub.lessonsLeft > 0 && new Date(sub.expiryDate) < today;
const getWeekStart = (date) => {
  const d = new Date(date); d.setHours(0,0,0,0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
};

const m = today.getMonth(), y = today.getFullYear();

// ─── Supabase: конвертация между camelCase (в приложении) и snake_case (в БД) ─
const rowToTeacher = (r) => ({ id:r.id, name:r.name, role:r.role, directions:r.directions||[], email:r.email||"", authUserId:r.auth_user_id||null });
const teacherToRow = (t) => ({ name:t.name, role:t.role, directions:t.directions||[] });

const rowToStudent = (r) => ({
  id:r.id, fullName:r.full_name, birthDate:r.birth_date||"", isMinor:!!r.is_minor,
  parentName:r.parent_name||"", parentPhone:r.parent_phone||"",
  phone:r.phone, messenger:r.messenger, messengerContact:r.messenger_contact||"",
  directions:r.directions||[],
});
const studentToRow = (s) => ({
  full_name:s.fullName, birth_date:s.birthDate||null, is_minor:!!s.isMinor,
  parent_name:s.parentName||null, parent_phone:s.parentPhone||null,
  phone:s.phone, messenger:s.messenger, messenger_contact:s.messengerContact||null,
  directions:s.directions||[],
});

const rowToSub = (r) => ({
  id:r.id, studentId:r.student_id, direction:r.direction, typeKey:r.type_key, typeLabel:r.type_label,
  price:r.price, totalLessons:r.total_lessons, lessonsLeft:r.lessons_left,
  purchaseDate:r.purchase_date, expiryDate:r.expiry_date, status:r.status, paymentMethod:r.payment_method,
});
const subToRow = (s) => ({
  student_id:s.studentId, direction:s.direction, type_key:s.typeKey, type_label:s.typeLabel,
  price:s.price, total_lessons:s.totalLessons, lessons_left:s.lessonsLeft,
  purchase_date:s.purchaseDate, expiry_date:s.expiryDate, status:s.status, payment_method:s.paymentMethod,
});

const rowToLesson = (r) => ({
  id:r.id, studentId:r.student_id, teacherId:r.teacher_id, subId:r.sub_id,
  direction:r.direction, date:r.date, status:r.status, accessLink:r.access_link||"",
});
const lessonToRow = (l) => ({
  student_id:l.studentId, teacher_id:l.teacherId, sub_id:l.subId,
  direction:l.direction, date:l.date, status:l.status, access_link:l.accessLink||null,
});

const rowToExpense = (r) => ({ id:r.id, category:r.category, amount:r.amount, date:r.date, comment:r.comment||"" });
const expenseToRow = (e) => ({ category:e.category, amount:e.amount, date:e.date, comment:e.comment||null });

// ─── ЛОГОТИП (реальное изображение, base64) ───────────────────────────────────
const LOGO_SRC = "data:image/jpeg;base64,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";

const IC = {
  today:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"/></svg>,
  users:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  cal:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  money:  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  back:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  plus:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  check:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  close:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  warn:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  send:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  repeat: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  chevL:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chevR:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  teacher:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>,
};

const Card = ({children,style,onClick}) => (
  <div onClick={onClick} style={{background:T.surface,borderRadius:14,padding:16,marginBottom:10,
    boxShadow:"0 1px 4px rgba(0,0,0,.07)",cursor:onClick?"pointer":"default",...style}}>
    {children}
  </div>
);
const vStyle = (v) => ({
  primary: {background:T.primary,   color:"#fff"},
  accent:  {background:T.accent,    color:"#fff"},
  ghost:   {background:"transparent",color:T.primary,border:`1.5px solid ${T.border}`},
  danger:  {background:T.dangerBg,  color:T.danger},
  success: {background:T.successBg, color:T.success},
  warning: {background:T.warningBg, color:T.warning},
}[v]||{});
const Btn = ({children,onClick,variant="primary",small,style,disabled}) => (
  <button onClick={onClick} disabled={disabled} style={{
    border:"none",borderRadius:9,padding:small?"5px 11px":"11px 18px",
    fontSize:small?12:14,fontWeight:600,cursor:disabled?"default":"pointer",
    display:"inline-flex",alignItems:"center",gap:5,opacity:disabled?.5:1,
    ...vStyle(variant),...style}}>{children}</button>
);
const cMap = {
  primary:{bg:T.primaryLight,text:T.primary},success:{bg:T.successBg,text:T.success},
  warning:{bg:T.warningBg,text:T.warning},danger:{bg:T.dangerBg,text:T.danger},
  muted:{bg:T.muted,text:T.textSub},accent:{bg:T.accentLight,text:T.accent},
};
const Badge = ({children,color="primary"}) => {
  const c = cMap[color]||cMap.muted;
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 9px",
    borderRadius:20,fontSize:11,fontWeight:600,background:c.bg,color:c.text}}>{children}</span>;
};
const SInput = ({label,value,onChange,type="text",placeholder,required,disabled}) => (
  <div style={{marginBottom:13}}>
    {label&&<label style={{display:"block",fontSize:11,fontWeight:700,color:T.textSub,
      marginBottom:5,textTransform:"uppercase",letterSpacing:.7}}>{label}{required&&" *"}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled} style={{width:"100%",boxSizing:"border-box",
        border:`1.5px solid ${T.border}`,borderRadius:9,padding:"10px 12px",fontSize:14,
        color:T.textMain,background:disabled?T.muted:T.surface,outline:"none"}}/>
  </div>
);
const SSelect = ({label,value,onChange,options,required}) => (
  <div style={{marginBottom:13}}>
    {label&&<label style={{display:"block",fontSize:11,fontWeight:700,color:T.textSub,
      marginBottom:5,textTransform:"uppercase",letterSpacing:.7}}>{label}{required&&" *"}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",boxSizing:"border-box",
      border:`1.5px solid ${T.border}`,borderRadius:9,padding:"10px 12px",fontSize:14,
      color:T.textMain,background:T.surface,outline:"none",appearance:"none"}}>
      {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
    </select>
  </div>
);
const Modal = ({title,onClose,children,onSave,saveLabel="Сохранить"}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:1000,
    display:"flex",flexDirection:"column",justifyContent:"flex-end",backdropFilter:"blur(3px)"}}>
    <div style={{background:T.surface,borderRadius:"18px 18px 0 0",
      padding:"20px 20px 36px",maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
        <div style={{fontWeight:800,fontSize:17,color:T.textMain}}>{title}</div>
        <button onClick={onClose} style={{border:"none",background:T.muted,borderRadius:8,
          padding:7,cursor:"pointer",color:T.textSub,display:"flex"}}>{IC.close}</button>
      </div>
      {children}
      {onSave&&<Btn onClick={onSave} style={{width:"100%",justifyContent:"center",marginTop:6}}>{saveLabel}</Btn>}
    </div>
  </div>
);

function LessonCard({lesson,student,teacher,sub,onMark,onLink,compact}) {
  const [open,setOpen] = useState(false);
  if(!student) return null;
  const tc = teacherColor(lesson.teacherId);
  const sm = statusMeta(lesson.status);
  const isPlanned = lesson.status === "planned";
  const contactName = student.isMinor ? student.parentName : student.fullName.split(" ")[1]||student.fullName;
  return (
    <div style={{background:T.surface,borderRadius:12,marginBottom:8,overflow:"hidden",
      boxShadow:"0 1px 4px rgba(0,0,0,.06)",borderLeft:`4px solid ${tc.dot}`}}>
      <div onClick={()=>isPlanned&&setOpen(o=>!o)} style={{padding:"12px 14px",
        display:"flex",alignItems:"center",gap:10,cursor:isPlanned?"pointer":"default"}}>
        <div style={{fontWeight:800,fontSize:15,color:T.textMain,minWidth:44,flexShrink:0}}>
          {fmtTime(lesson.date)}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {compact ? student.fullName.split(" ").slice(0,2).join(" ") : student.fullName}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3,flexWrap:"wrap"}}>
            <span style={{fontSize:11,padding:"1px 7px",borderRadius:10,
              background:tc.bg,color:tc.text,fontWeight:600}}>{teacher?.name||"—"}</span>
            <span style={{fontSize:11,color:T.textSub}}>{lesson.direction}</span>
            {sub&&<span style={{fontSize:11,color:T.textSub}}>· {sub.lessonsLeft}/{sub.totalLessons}</span>}
          </div>
        </div>
        <Badge color={sm.color}>{sm.label}</Badge>
      </div>
      {isPlanned&&open&&(
        <div style={{padding:"0 14px 12px",display:"flex",gap:6,flexWrap:"wrap",
          borderTop:`1px solid ${T.border}`,paddingTop:10}}>
          <Btn small variant="success" onClick={()=>{onMark(lesson.id,"attended");setOpen(false);}}>{IC.check} Пришёл</Btn>
          <Btn small variant="danger"  onClick={()=>{onMark(lesson.id,"missed");setOpen(false);}}>{IC.close} Пропуск</Btn>
          <Btn small variant="warning" onClick={()=>{onMark(lesson.id,"rescheduled");setOpen(false);}}>{IC.repeat} Перенос</Btn>
          <Btn small variant="ghost"   onClick={()=>onLink(lesson.id,contactName,student.messenger)}>{IC.send} Пропуск</Btn>
        </div>
      )}
      {!isPlanned&&lesson.accessLink&&(
        <div style={{padding:"2px 14px 8px",fontSize:11,color:T.textSub}}>🔗 пропуск отправлен</div>
      )}
    </div>
  );
}

function TodayScreen({students,subs,schedule,expenses,teachers,onMark,onLink,onSelectStudent}) {
  const todayLessons = useMemo(()=>
    schedule.filter(l=>l.date.startsWith(todayStr)).sort((a,b)=>a.date.localeCompare(b.date)),[schedule]);
  const monthLessons = schedule.filter(l=>{
    const d=new Date(l.date); return l.status==="attended"&&d.getMonth()===m&&d.getFullYear()===y;
  }).length;
  const monthIncome = subs.filter(s=>{
    const d=new Date(s.purchaseDate); return d.getMonth()===m&&d.getFullYear()===y;
  }).reduce((a,s)=>a+s.price,0);
  const warnSubs   = subs.filter(s=>s.status==="active"&&s.lessonsLeft===2);
  const dangerSubs = subs.filter(s=>s.status==="active"&&s.lessonsLeft<=1);
  const expiredSubs= subs.filter(subDateExpired);
  const dateLabel  = today.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});
  return (
    <div style={{padding:"16px 16px 8px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[
          {label:"Учеников",   val:students.length,      bg:T.primaryLight},
          {label:"Занятий/мес",val:monthLessons,          bg:"#EEEBE8"},
          {label:"Доход/мес",  val:fmtMoney(monthIncome), bg:T.successBg},
        ].map(s=>(
          <div key={s.label} style={{background:s.bg,borderRadius:12,padding:"12px 10px"}}>
            <div style={{fontSize:16,fontWeight:800,color:T.primary,lineHeight:1.1}}>{s.val}</div>
            <div style={{fontSize:10,color:T.textSub,marginTop:3,fontWeight:500}}>{s.label}</div>
          </div>
        ))}
      </div>
      {expiredSubs.length>0&&(
        <div style={{background:"#FFF7F5",border:`1.5px solid #F5C5B8`,borderRadius:12,
          padding:"10px 13px",marginBottom:10}}>
          <div style={{fontWeight:700,color:T.accent,fontSize:12,display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
            {IC.warn} Срок абонемента истёк — остались занятия
          </div>
          {expiredSubs.map(s=>{
            const st=students.find(x=>x.id===s.studentId);
            return <div key={s.id} style={{color:T.accent,fontSize:12,paddingLeft:20}}>
              {st?.fullName} · {s.direction} · {s.lessonsLeft} зан.</div>;
          })}
        </div>
      )}
      {dangerSubs.length>0&&(
        <Card style={{background:T.dangerBg,border:`1.5px solid #F5C0BB`,padding:"12px 14px",marginBottom:10}}>
          <div style={{fontWeight:700,fontSize:12,color:T.danger,display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
            {IC.warn} Последнее занятие — напомните об оплате
          </div>
          {dangerSubs.map(s=>{
            const st=students.find(x=>x.id===s.studentId);
            return <div key={s.id} onClick={()=>onSelectStudent(s.studentId)} style={{
              display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"6px 0",borderBottom:`1px solid #F5C0BB`,cursor:"pointer"}}>
              <div style={{fontSize:13}}><span style={{fontWeight:600}}>{st?.fullName}</span>
                <span style={{color:T.textSub,fontSize:11}}> · {s.direction}</span></div>
              <Badge color="danger">1 занятие</Badge>
            </div>;
          })}
        </Card>
      )}
      {warnSubs.length>0&&(
        <Card style={{background:T.warningBg,border:`1.5px solid #EDD9A0`,padding:"10px 14px",marginBottom:10}}>
          <div style={{fontWeight:700,fontSize:12,color:T.warning,display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
            🔔 Скоро закончится абонемент (2 занятия)
          </div>
          {warnSubs.map(s=>{
            const st=students.find(x=>x.id===s.studentId);
            return <div key={s.id} style={{fontSize:12,color:T.warning,paddingLeft:20}}>
              {st?.fullName} · {s.direction}</div>;
          })}
        </Card>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontWeight:700,fontSize:14,textTransform:"capitalize"}}>{dateLabel}</div>
        <Badge color={todayLessons.length>0?"accent":"muted"}>{todayLessons.length} занятий</Badge>
      </div>
      {todayLessons.length===0&&(
        <div style={{textAlign:"center",color:T.textSub,padding:"30px 0",fontSize:14}}>Сегодня занятий нет</div>
      )}
      {todayLessons.map(lesson=>(
        <LessonCard key={lesson.id} lesson={lesson}
          student={students.find(s=>s.id===lesson.studentId)}
          teacher={teachers.find(t=>t.id===lesson.teacherId)}
          sub={subs.find(s=>s.id===lesson.subId)}
          onMark={onMark} onLink={onLink}/>
      ))}
    </div>
  );
}

function StudentsScreen({students,subs,onSelect,onAdd}) {
  const [q,setQ]=useState("");
  const list=useMemo(()=>students.filter(s=>
    s.fullName.toLowerCase().includes(q.toLowerCase())||s.phone.includes(q)),[students,q]);
  return (
    <div style={{padding:16}}>
      <div style={{position:"relative",marginBottom:12}}>
        <div style={{position:"absolute",left:12,top:11,color:T.textSub}}>{IC.search}</div>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск по имени или телефону…"
          style={{width:"100%",boxSizing:"border-box",border:`1.5px solid ${T.border}`,
            borderRadius:10,padding:"10px 12px 10px 36px",fontSize:14,color:T.textMain,
            background:T.surface,outline:"none"}}/>
      </div>
      <Btn onClick={onAdd} style={{width:"100%",justifyContent:"center",marginBottom:14}}>
        {IC.plus} Добавить ученика
      </Btn>
      <div style={{fontSize:11,color:T.textSub,fontWeight:700,letterSpacing:.4,
        textTransform:"uppercase",marginBottom:8}}>Всего: {list.length}</div>
      {list.map(st=>{
        const activeSubs=subs.filter(s=>s.studentId===st.id&&s.status==="active");
        const allCount=subs.filter(s=>s.studentId===st.id).length;
        const alertLvl=activeSubs.reduce((max,s)=>{
          const lv=subAlert(s); return lv==="danger"?"danger":lv==="warning"&&max!=="danger"?"warning":max;
        },"none");
        return (
          <Card key={st.id} onClick={()=>onSelect(st.id)} style={{padding:"13px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:40,height:40,borderRadius:20,flexShrink:0,
                background:alertLvl==="danger"?T.dangerBg:alertLvl==="warning"?T.warningBg:T.primaryLight,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,
                color:alertLvl==="danger"?T.danger:alertLvl==="warning"?T.warning:T.primary}}>
                {st.fullName[0]}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontWeight:600,fontSize:14}}>{st.fullName}</div>
                  {alertLvl==="danger"&&<span>⚠️</span>}{alertLvl==="warning"&&<span>🔔</span>}
                </div>
                <div style={{fontSize:12,color:T.textSub,marginTop:1}}>
                  {messengerEmoji(st.messenger)} {st.messenger}{st.isMinor&&" · 👶 ребёнок"}
                  <span style={{marginLeft:6,opacity:.6}}>{allCount} абон.</span>
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>
                  {activeSubs.length===0?<Badge color="muted">Нет активного абонемента</Badge>
                    :activeSubs.map(s=>(
                      <Badge key={s.id} color={subAlert(s)==="none"?"primary":subAlert(s)}>
                        {s.direction} {s.lessonsLeft}/{s.totalLessons}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
      {list.length===0&&<div style={{textAlign:"center",color:T.textSub,marginTop:40}}>Не найдено</div>}
    </div>
  );
}

function TeachersScreen({teachers,isAdmin,onAdd,onEdit,onDelete}) {
  return (
    <div style={{padding:16}}>
      {isAdmin&&<Btn onClick={onAdd} style={{width:"100%",justifyContent:"center",marginBottom:14}}>
        {IC.plus} Добавить педагога
      </Btn>}
      <div style={{fontSize:11,color:T.textSub,fontWeight:700,letterSpacing:.4,
        textTransform:"uppercase",marginBottom:8}}>Всего: {teachers.length}</div>
      {teachers.map(t=>{
        const tc=teacherColor(t.id);
        return (
          <Card key={t.id} style={{padding:"13px 14px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:40,height:40,borderRadius:20,flexShrink:0,
                background:tc.bg,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:16,fontWeight:800,color:tc.text}}>
                {t.name[0]}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14}}>{t.name}</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:5}}>
                  <Badge color="primary">{ROLE_LABELS[t.role]||t.role}</Badge>
                  {t.directions.map(d=><Badge key={d} color="muted">{d}</Badge>)}
                </div>
              </div>
            </div>
            {isAdmin&&<div style={{display:"flex",gap:6,marginTop:10}}>
              <Btn small variant="ghost" onClick={()=>onEdit(t)}>Редактировать</Btn>
              <Btn small variant="danger" onClick={()=>onDelete(t.id)}>Удалить</Btn>
            </div>}
          </Card>
        );
      })}
      {teachers.length===0&&<div style={{textAlign:"center",color:T.textSub,marginTop:40}}>Педагогов нет</div>}
    </div>
  );
}

function StudentDetail({student,subs,schedule,teachers,onBack,onAddSub,onMarkSub,onLink,onEdit,onDelete,onDeleteSub}) {
  const [tab,setTab]=useState("subs");
  if(!student) return null;
  const activeSubs=subs.filter(s=>s.status==="active");
  const allSubs=[...subs].sort((a,b)=>new Date(b.purchaseDate)-new Date(a.purchaseDate));
  const history=[...schedule].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const totalAttended=schedule.filter(l=>l.status==="attended").length;
  const contactName=student.isMinor?student.parentName:student.fullName.split(" ")[1]||student.fullName;
  return (
    <div>
      <div style={{background:T.nav,borderBottom:`1px solid ${T.navBorder}`,padding:"14px 16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <button onClick={onBack} style={{border:"none",background:T.muted,borderRadius:8,
            padding:6,cursor:"pointer",color:T.textMain,display:"flex"}}>{IC.back}</button>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:15,color:T.textMain}}>{student.fullName}</div>
            <div style={{fontSize:11,color:T.textSub}}>
              {messengerEmoji(student.messenger)} {student.messenger}
              {student.isMinor&&" · 👶 ребёнок"} · {subs.length} абон. · {totalAttended} занятий
            </div>
          </div>
        </div>
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`}}>
          {[{key:"subs",label:"Абонементы"},{key:"lessons",label:"Журнал"},{key:"info",label:"Карточка"}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} style={{
              border:"none",background:"none",color:tab===t.key?T.accent:T.textSub,cursor:"pointer",
              padding:"8px 16px",fontSize:13,fontWeight:tab===t.key?700:400,
              borderBottom:tab===t.key?`2.5px solid ${T.accent}`:"2.5px solid transparent"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:16}}>
        {tab==="subs"&&(
          <div>
            <Btn onClick={onAddSub} style={{width:"100%",justifyContent:"center",marginBottom:14}}>
              {IC.plus} Новый абонемент
            </Btn>
            {activeSubs.length===0&&<div style={{textAlign:"center",color:T.textSub,marginBottom:16,fontSize:14}}>Нет активных абонементов</div>}
            {activeSubs.map(sub=>{
              const alert=subAlert(sub); const expired=subDateExpired(sub);
              const progress=(sub.totalLessons-sub.lessonsLeft)/sub.totalLessons;
              return (
                <Card key={sub.id} style={{border:`1.5px solid ${alert==="danger"?T.danger:alert==="warning"?"#EDD9A0":T.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:14}}>{sub.direction}</div>
                      <div style={{fontSize:12,color:T.textSub,marginTop:1}}>{sub.typeLabel}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontWeight:800,fontSize:24,lineHeight:1,
                        color:alert==="danger"?T.danger:alert==="warning"?T.warning:T.primary}}>{sub.lessonsLeft}</div>
                      <div style={{fontSize:11,color:T.textSub}}>из {sub.totalLessons}</div>
                    </div>
                  </div>
                  <div style={{height:5,background:T.border,borderRadius:3,marginBottom:10,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:3,width:`${progress*100}%`,transition:"width .3s",
                      background:alert==="danger"?T.danger:alert==="warning"?T.warning:T.primary}}/>
                  </div>
                  {expired&&<div style={{background:T.accentLight,borderRadius:8,padding:"7px 10px",
                    fontSize:12,color:T.accent,fontWeight:600,marginBottom:10,display:"flex",alignItems:"center",gap:5}}>
                    {IC.warn} Срок истёк, занятий: {sub.lessonsLeft} — уточните у клиента.</div>}
                  {alert==="danger"&&!expired&&<div style={{background:T.dangerBg,borderRadius:8,padding:"7px 10px",
                    fontSize:12,color:T.danger,fontWeight:600,marginBottom:10,display:"flex",alignItems:"center",gap:5}}>
                    {IC.warn} Последнее занятие! Напомните об оплате.</div>}
                  {alert==="warning"&&<div style={{background:T.warningBg,borderRadius:8,padding:"7px 10px",
                    fontSize:12,color:T.warning,fontWeight:600,marginBottom:10,display:"flex",alignItems:"center",gap:5}}>
                    🔔 Осталось 2 занятия — скоро нужно продлить.</div>}
                  <div style={{display:"flex",gap:8,fontSize:12,color:T.textSub,marginBottom:12,flexWrap:"wrap"}}>
                    <span>📅 до {fmtDate(sub.expiryDate)}</span>
                    <span>💳 {sub.paymentMethod}</span>
                    <span>💰 {fmtMoney(sub.price)}</span>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <Btn small variant="success" onClick={()=>onMarkSub(sub.id,"attended")}>{IC.check} Посетил</Btn>
                    <Btn small variant="danger"  onClick={()=>onMarkSub(sub.id,"missed")}>{IC.close} Пропуск</Btn>
                    <Btn small variant="warning" onClick={()=>onMarkSub(sub.id,"rescheduled")}>{IC.repeat} Перенос</Btn>
                    <Btn small variant="ghost"   onClick={()=>onLink(null,contactName,student.messenger)}>{IC.send} Пропуск</Btn>
                  </div>
                </Card>
              );
            })}
            {allSubs.filter(s=>s.status!=="active").length>0&&<>
              <div style={{fontSize:11,color:T.textSub,fontWeight:700,letterSpacing:.4,
                textTransform:"uppercase",margin:"16px 0 8px"}}>История абонементов</div>
              {allSubs.filter(s=>s.status!=="active").map(sub=>(
                <div key={sub.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"9px 0",borderBottom:`1px solid ${T.border}`,fontSize:13,opacity:.65}}>
                  <div>
                    <div style={{fontWeight:600}}>{sub.direction} · {sub.typeLabel}</div>
                    <div style={{fontSize:11,color:T.textSub}}>{fmtDate(sub.purchaseDate)} — {fmtDate(sub.expiryDate)}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{textAlign:"right"}}>
                      <Badge color="muted">Завершён</Badge>
                      <div style={{fontSize:11,color:T.textSub,marginTop:3}}>{fmtMoney(sub.price)}</div>
                    </div>
                    <Btn small variant="ghost" onClick={()=>onDeleteSub(sub.id)} style={{padding:"4px 8px"}}>{IC.close}</Btn>
                  </div>
                </div>
              ))}
            </>}
          </div>
        )}
        {tab==="lessons"&&(
          <div>
            <div style={{fontSize:11,color:T.textSub,fontWeight:700,letterSpacing:.4,
              textTransform:"uppercase",marginBottom:10}}>
              Посетил: {totalAttended} · всего: {history.length}
            </div>
            {history.length===0&&<div style={{textAlign:"center",color:T.textSub,marginTop:32}}>Нет занятий</div>}
            {history.map(l=>{
              const si=statusMeta(l.status);
              return (
                <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{fmtDate(l.date)}{fmtTime(l.date)&&` · ${fmtTime(l.date)}`} · {l.direction}</div>
                    {l.accessLink&&<div style={{fontSize:11,color:T.textSub,marginTop:1}}>🔗 пропуск отправлен</div>}
                  </div>
                  <Badge color={si.color}>{si.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
        {tab==="info"&&(
          <>
            <Card>
              <div style={{fontSize:11,fontWeight:700,color:T.textSub,marginBottom:12,letterSpacing:.5,textTransform:"uppercase"}}>Контактная информация</div>
              {[
                {label:"Телефон",val:student.phone},
                {label:"Мессенджер",val:`${messengerEmoji(student.messenger)} ${student.messenger}`},
                {label:"Контакт",val:student.messengerContact},
                ...(student.isMinor?[{label:"Родитель",val:student.parentName},{label:"Тел. родит.",val:student.parentPhone}]:[]),
                {label:"Направления",val:student.directions?.join(", ")||"—"},
              ].map(row=>(
                <div key={row.label} style={{display:"flex",justifyContent:"space-between",
                  padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
                  <span style={{color:T.textSub,fontWeight:500}}>{row.label}</span>
                  <span style={{fontWeight:600,textAlign:"right",maxWidth:"60%"}}>{row.val||"—"}</span>
                </div>
              ))}
            </Card>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <Btn variant="ghost" onClick={onEdit} style={{justifyContent:"center"}}>Редактировать</Btn>
              <Btn variant="danger" onClick={()=>{if(confirm("Удалить ученика и все его данные?"))onDelete();}}
                style={{justifyContent:"center"}}>Удалить ученика</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CalendarScreen({students,subs,schedule,teachers,onMark,onLink,onAddLesson}) {
  const [weekStart,setWeekStart]=useState(getWeekStart(today));
  const [selDay,setSelDay]=useState(todayStr);
  const weekDays=useMemo(()=>[0,1,2,3,4,5,6].map(i=>addDays(weekStart,i)),[weekStart]);
  const dayLessons=useMemo(()=>schedule.filter(l=>l.date.startsWith(selDay)).sort((a,b)=>a.date.localeCompare(b.date)),[schedule,selDay]);
  const weekLabel=`${weekStart.getDate()} – ${addDays(weekStart,6).getDate()} ${MONTH_NAMES[addDays(weekStart,6).getMonth()]}`;
  return (
    <div>
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,
        padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={()=>setWeekStart(d=>addDays(d,-7))} style={{border:"none",background:T.muted,
          borderRadius:8,padding:6,cursor:"pointer",color:T.textSub,display:"flex"}}>{IC.chevL}</button>
        <div style={{fontWeight:700,fontSize:14}}>{weekLabel}</div>
        <button onClick={()=>setWeekStart(d=>addDays(d,7))} style={{border:"none",background:T.muted,
          borderRadius:8,padding:6,cursor:"pointer",color:T.textSub,display:"flex"}}>{IC.chevR}</button>
      </div>
      <div style={{background:T.surface,display:"flex",borderBottom:`1px solid ${T.border}`,padding:"8px 8px 0"}}>
        {weekDays.map(day=>{
          const ds=toDateStr(day),cnt=schedule.filter(l=>l.date.startsWith(ds)).length;
          const isToday=ds===todayStr,isSel=ds===selDay;
          return (
            <div key={ds} onClick={()=>setSelDay(ds)} style={{flex:1,display:"flex",flexDirection:"column",
              alignItems:"center",padding:"6px 2px 10px",cursor:"pointer",
              borderBottom:isSel?`2.5px solid ${T.accent}`:"2.5px solid transparent"}}>
              <div style={{fontSize:10,fontWeight:isToday?700:500,marginBottom:4,
                color:isToday?T.accent:T.textSub}}>{WEEK_DAYS[day.getDay()]}</div>
              <div style={{width:28,height:28,borderRadius:14,display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:13,fontWeight:700,
                background:isToday?T.accent:isSel?T.primaryLight:"transparent",
                color:isToday?"#fff":isSel?T.primary:T.textMain}}>{day.getDate()}</div>
              {cnt>0&&<div style={{width:5,height:5,borderRadius:3,marginTop:3,
                background:isSel?T.accent:T.textSub,opacity:.6}}/>}
            </div>
          );
        })}
      </div>
      <div style={{padding:"14px 14px 8px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:14}}>
            {new Date(selDay+"T12:00:00").toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})}
          </div>
          <Btn small onClick={onAddLesson}>{IC.plus} Занятие</Btn>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {teachers.map(t=>{
            const tc=teacherColor(t.id);
            return <span key={t.id} style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,
              background:tc.bg,color:tc.text,display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:6,height:6,borderRadius:3,background:tc.dot,display:"inline-block"}}/>
              {t.name}</span>;
          })}
        </div>
        {dayLessons.length===0&&<div style={{textAlign:"center",color:T.textSub,padding:"30px 0",fontSize:14}}>Занятий не запланировано</div>}
        {dayLessons.map(lesson=>(
          <LessonCard key={lesson.id} lesson={lesson} compact
            student={students.find(s=>s.id===lesson.studentId)}
            teacher={teachers.find(t=>t.id===lesson.teacherId)}
            sub={subs.find(s=>s.id===lesson.subId)}
            onMark={onMark} onLink={onLink}/>
        ))}
      </div>
    </div>
  );
}

function FinancesScreen({subs,schedule,expenses,onAddExpense,onDeleteExpense}) {
  const monthLabel=today.toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
  const monthSubs=subs.filter(s=>{const d=new Date(s.purchaseDate);return d.getMonth()===m&&d.getFullYear()===y;});
  const income=monthSubs.reduce((a,s)=>a+s.price,0);
  const monthExp=expenses.filter(e=>{const d=new Date(e.date);return d.getMonth()===m&&d.getFullYear()===y;});
  const expTotal=monthExp.reduce((a,e)=>a+e.amount,0);
  const attendedLessons=schedule.filter(l=>{
    const d=new Date(l.date);return l.status==="attended"&&d.getMonth()===m&&d.getFullYear()===y;
  });
  const trialCount=attendedLessons.filter(l=>subs.find(s=>s.id===l.subId)?.typeKey==="trial").length;
  const regularCount=attendedLessons.length-trialCount;
  const payroll=regularCount*TEACHER_RATE+trialCount*TRIAL_TEACHER_RATE;
  const totalExp=expTotal+payroll;
  const profit=income-totalExp;
  return (
    <div style={{padding:16}}>
      <div style={{fontWeight:800,fontSize:16,marginBottom:14,textTransform:"capitalize"}}>📅 {monthLabel}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {[
          {label:"Доход",   val:income,   icon:"💰",bg:T.successBg, color:T.success},
          {label:"Расходы", val:totalExp, icon:"📉",bg:T.warningBg, color:T.warning},
          {label:"Зарплата",val:payroll,  icon:"👩‍🏫",bg:T.primaryLight,color:T.primary},
          {label:"Прибыль", val:profit,   icon:profit>=0?"📈":"⚠️",
            bg:profit>=0?T.successBg:T.dangerBg,color:profit>=0?T.success:T.danger},
        ].map(s=>(
          <div key={s.label} style={{background:s.bg,borderRadius:14,padding:"14px"}}>
            <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
            <div style={{fontSize:16,fontWeight:800,color:s.color,lineHeight:1.1}}>{fmtMoney(s.val)}</div>
            <div style={{fontSize:11,color:T.textSub,marginTop:2,fontWeight:500}}>{s.label}</div>
          </div>
        ))}
      </div>
      <Card>
        <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>👩‍🏫 Расчёт зарплаты</div>
        {[["Обычных занятий",String(regularCount)],["Ставка за обычное занятие",fmtMoney(TEACHER_RATE)],
          ["Пробных занятий",String(trialCount)],["Ставка за пробное занятие",fmtMoney(TRIAL_TEACHER_RATE)]].map(([l,v])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,
            padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
            <span style={{color:T.textSub}}>{l}</span><span style={{fontWeight:700}}>{v}</span>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"8px 0"}}>
          <span style={{fontWeight:700}}>Итого к выплате</span>
          <span style={{fontWeight:800,color:T.primary}}>{fmtMoney(payroll)}</span>
        </div>
      </Card>
      <Card>
        <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>💰 Поступления</div>
        {monthSubs.length===0&&<div style={{color:T.textSub,fontSize:13}}>Нет поступлений</div>}
        {monthSubs.map(s=>(
          <div key={s.id} style={{display:"flex",justifyContent:"space-between",
            padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
            <div><div style={{fontWeight:600}}>Абонемент · {s.direction}</div>
              <div style={{fontSize:11,color:T.textSub}}>{s.typeLabel} · {s.paymentMethod}</div></div>
            <span style={{fontWeight:700,color:T.success}}>+{fmtMoney(s.price)}</span>
          </div>
        ))}
        {monthSubs.length>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,
          padding:"8px 0",fontWeight:700}}>
          <span>Итого</span><span style={{color:T.success}}>{fmtMoney(income)}</span></div>}
      </Card>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontWeight:700,fontSize:13}}>📊 Расходы</div>
          <Btn small variant="ghost" onClick={onAddExpense}>{IC.plus} Добавить</Btn>
        </div>
        {monthExp.length===0&&payroll===0&&<div style={{color:T.textSub,fontSize:13}}>Нет расходов</div>}
        {monthExp.map(e=>(
          <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
            <div><div style={{fontWeight:600}}>{e.category}</div>
              {e.comment&&<div style={{fontSize:11,color:T.textSub}}>{e.comment}</div>}</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontWeight:700,color:T.danger}}>−{fmtMoney(e.amount)}</span>
              <Btn small variant="ghost" onClick={()=>onDeleteExpense(e.id)} style={{padding:"4px 8px"}}>{IC.close}</Btn>
            </div>
          </div>
        ))}
        {payroll>0&&(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:13}}>
            <div style={{fontWeight:600}}>Зарплата педагогов (зарплата)</div>
            <span style={{fontWeight:700,color:T.danger}}>−{fmtMoney(payroll)}</span>
          </div>
        )}
        {(monthExp.length>0||payroll>0)&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,
          padding:"8px 0",fontWeight:700}}>
          <span>Итого</span><span style={{color:T.danger}}>{fmtMoney(totalExp)}</span></div>}
      </Card>
    </div>
  );
}

function AddStudentModal({onClose,onSave}) {
  const [f,setF]=useState({fullName:"",birthDate:"",isMinor:false,parentName:"",parentPhone:"",
    phone:"",messenger:"SMS",messengerContact:"",directions:[]});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const td=(d)=>s("directions",f.directions.includes(d)?f.directions.filter(x=>x!==d):[...f.directions,d]);
  return (
    <Modal title="Новый ученик" onClose={onClose}
      onSave={()=>{if(!f.fullName.trim()||!f.phone.trim()){alert("Заполните ФИО и телефон");return;}onSave(f);}}
      saveLabel="Добавить ученика">
      <SInput label="ФИО *" value={f.fullName} onChange={v=>s("fullName",v)} placeholder="Фамилия Имя Отчество" required/>
      <SInput label="Дата рождения" value={f.birthDate} onChange={v=>s("birthDate",v)} type="date"/>
      <div style={{marginBottom:14}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
          <input type="checkbox" checked={f.isMinor} onChange={e=>s("isMinor",e.target.checked)}
            style={{width:16,height:16,accentColor:T.accent}}/>
          Ребёнок до 13 лет — нужны данные родителя
        </label>
      </div>
      {f.isMinor&&<><SInput label="ФИО родителя *" value={f.parentName} onChange={v=>s("parentName",v)}/>
        <SInput label="Телефон родителя *" value={f.parentPhone} onChange={v=>s("parentPhone",v)} type="tel"/></>}
      <SInput label="Телефон *" value={f.phone} onChange={v=>s("phone",v)} type="tel" placeholder="+7 XXX XXX-XX-XX" required/>
      <SSelect label="Мессенджер" value={f.messenger} onChange={v=>s("messenger",v)} options={MESSENGERS.map(x=>({value:x,label:x}))}/>
      <SInput label="Контакт в мессенджере" value={f.messengerContact} onChange={v=>s("messengerContact",v)} placeholder="@username или номер"/>
      <div>
        <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textSub,
          marginBottom:8,textTransform:"uppercase",letterSpacing:.7}}>Направления</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {DIRECTIONS.map(d=>(
            <button key={d} onClick={()=>td(d)} style={{
              border:`2px solid ${f.directions.includes(d)?T.accent:T.border}`,
              borderRadius:20,padding:"6px 14px",fontSize:13,fontWeight:600,cursor:"pointer",
              background:f.directions.includes(d)?T.accentLight:"transparent",
              color:f.directions.includes(d)?T.accent:T.textSub}}>{d}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function EditStudentModal({student,onClose,onSave}) {
  const [f,setF]=useState({fullName:student.fullName,birthDate:student.birthDate,isMinor:student.isMinor,
    parentName:student.parentName,parentPhone:student.parentPhone,
    phone:student.phone,messenger:student.messenger,messengerContact:student.messengerContact,
    directions:student.directions||[]});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const td=(d)=>s("directions",f.directions.includes(d)?f.directions.filter(x=>x!==d):[...f.directions,d]);
  return (
    <Modal title="Редактировать ученика" onClose={onClose}
      onSave={()=>{if(!f.fullName.trim()||!f.phone.trim()){alert("Заполните ФИО и телефон");return;}onSave(f);}}
      saveLabel="Сохранить изменения">
      <SInput label="ФИО *" value={f.fullName} onChange={v=>s("fullName",v)} placeholder="Фамилия Имя Отчество" required/>
      <SInput label="Дата рождения" value={f.birthDate} onChange={v=>s("birthDate",v)} type="date"/>
      <div style={{marginBottom:14}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
          <input type="checkbox" checked={f.isMinor} onChange={e=>s("isMinor",e.target.checked)}
            style={{width:16,height:16,accentColor:T.accent}}/>
          Ребёнок до 13 лет — нужны данные родителя
        </label>
      </div>
      {f.isMinor&&<><SInput label="ФИО родителя *" value={f.parentName} onChange={v=>s("parentName",v)}/>
        <SInput label="Телефон родителя *" value={f.parentPhone} onChange={v=>s("parentPhone",v)} type="tel"/></>}
      <SInput label="Телефон *" value={f.phone} onChange={v=>s("phone",v)} type="tel" placeholder="+7 XXX XXX-XX-XX" required/>
      <SSelect label="Мессенджер" value={f.messenger} onChange={v=>s("messenger",v)} options={MESSENGERS.map(x=>({value:x,label:x}))}/>
      <SInput label="Контакт в мессенджере" value={f.messengerContact} onChange={v=>s("messengerContact",v)} placeholder="@username или номер"/>
      <div>
        <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textSub,
          marginBottom:8,textTransform:"uppercase",letterSpacing:.7}}>Направления</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {DIRECTIONS.map(d=>(
            <button key={d} onClick={()=>td(d)} style={{
              border:`2px solid ${f.directions.includes(d)?T.accent:T.border}`,
              borderRadius:20,padding:"6px 14px",fontSize:13,fontWeight:600,cursor:"pointer",
              background:f.directions.includes(d)?T.accentLight:"transparent",
              color:f.directions.includes(d)?T.accent:T.textSub}}>{d}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function AddSubModal({student,onClose,onSave}) {
  const [f,setF]=useState({direction:student?.directions?.[0]||DIRECTIONS[0],typeKey:"ind_4",paymentMethod:"Наличные"});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const type=SUB_TYPES.find(t=>t.key===f.typeKey);
  return (
    <Modal title="Новый абонемент" onClose={onClose} onSave={()=>onSave(f)} saveLabel="Добавить абонемент">
      <div style={{background:T.primaryLight,borderRadius:9,padding:"10px 12px",fontSize:13,fontWeight:600,marginBottom:14}}>
        Ученик: {student?.fullName}
      </div>
      <SSelect label="Направление" value={f.direction} onChange={v=>s("direction",v)} options={DIRECTIONS.map(d=>({value:d,label:d}))}/>
      <div style={{marginBottom:14}}>
        <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textSub,marginBottom:8,textTransform:"uppercase",letterSpacing:.7}}>Тип абонемента</label>
        {SUB_TYPES.map(t=>(
          <div key={t.key} onClick={()=>s("typeKey",t.key)} style={{
            border:`2px solid ${f.typeKey===t.key?T.accent:T.border}`,borderRadius:9,
            padding:"10px 14px",marginBottom:6,cursor:"pointer",
            background:f.typeKey===t.key?T.accentLight:T.surface,
            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:600,fontSize:13,color:f.typeKey===t.key?T.accent:T.textMain}}>{t.label}</div>
              <div style={{fontSize:11,color:T.textSub}}>{t.lessons} занятий · 1 месяц</div>
            </div>
            <div style={{fontWeight:800,fontSize:14,color:f.typeKey===t.key?T.accent:T.textMain}}>{fmtMoney(t.price)}</div>
          </div>
        ))}
      </div>
      <SSelect label="Способ оплаты" value={f.paymentMethod} onChange={v=>s("paymentMethod",v)}
        options={[{value:"Наличные",label:"Наличные"},{value:"Перевод",label:"Перевод"}]}/>
      {type&&<div style={{background:T.successBg,borderRadius:9,padding:"10px 12px",fontSize:13,color:T.success,fontWeight:600}}>
        ✓ {fmtMoney(type.price)} · {type.lessons} занятий · до {fmtDate(addMonths(today,1).toISOString())}
      </div>}
    </Modal>
  );
}

function AddLessonModal({students,teachers,subs,onClose,onSave}) {
  const [f,setF]=useState({studentId:students[0]?.id||"",teacherId:1,direction:DIRECTIONS[0],date:todayStr,time:"10:00"});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const matchSub=subs.find(sub=>sub.studentId===Number(f.studentId)&&sub.direction===f.direction&&sub.status==="active");
  return (
    <Modal title="Добавить занятие" onClose={onClose}
      onSave={()=>onSave({...f,studentId:Number(f.studentId),teacherId:Number(f.teacherId),subId:matchSub?.id||null})}
      saveLabel="Запланировать">
      <SSelect label="Ученик *" value={String(f.studentId)} onChange={v=>s("studentId",v)}
        options={students.map(st=>({value:String(st.id),label:st.fullName}))} required/>
      <SSelect label="Направление" value={f.direction} onChange={v=>s("direction",v)} options={DIRECTIONS.map(d=>({value:d,label:d}))}/>
      <SSelect label="Педагог" value={String(f.teacherId)} onChange={v=>s("teacherId",v)} options={teachers.map(t=>({value:String(t.id),label:t.name}))}/>
      <SInput label="Дата" value={f.date} onChange={v=>s("date",v)} type="date" required/>
      <SInput label="Время" value={f.time} onChange={v=>s("time",v)} type="time" required/>
      {matchSub
        ?<div style={{background:T.successBg,borderRadius:9,padding:"10px 12px",fontSize:13,color:T.success,fontWeight:600}}>
            ✓ Абонемент: {matchSub.direction} · {matchSub.lessonsLeft}/{matchSub.totalLessons} занятий</div>
        :<div style={{background:T.warningBg,borderRadius:9,padding:"10px 12px",fontSize:13,color:T.warning,fontWeight:600}}>
            ⚠ Абонемент по направлению не найден</div>}
    </Modal>
  );
}

function AddExpenseModal({onClose,onSave}) {
  const [f,setF]=useState({category:EXPENSE_CATS[0],amount:"",comment:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  return (
    <Modal title="Добавить расход" onClose={onClose}
      onSave={()=>{if(!f.amount){alert("Укажите сумму");return;}onSave({...f,amount:Number(f.amount)});}} saveLabel="Добавить">
      <SSelect label="Категория" value={f.category} onChange={v=>s("category",v)} options={EXPENSE_CATS.map(c=>({value:c,label:c}))}/>
      <SInput label="Сумма (₽) *" value={f.amount} onChange={v=>s("amount",v)} type="number" placeholder="0" required/>
      <SInput label="Комментарий" value={f.comment} onChange={v=>s("comment",v)} placeholder="Необязательно"/>
    </Modal>
  );
}

function TeacherModal({teacher,onClose,onSave}) {
  const [f,setF]=useState({name:teacher?.name||"",email:teacher?.email||"",role:teacher?.role||"teacher",directions:teacher?.directions||[]});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const td=(d)=>s("directions",f.directions.includes(d)?f.directions.filter(x=>x!==d):[...f.directions,d]);
  return (
    <Modal title={teacher?"Редактировать педагога":"Новый педагог"} onClose={onClose}
      onSave={()=>{
        if(!f.name.trim()){alert("Укажите имя");return;}
        if(!teacher&&!f.email.trim()){alert("Укажите email");return;}
        onSave(f);
      }}
      saveLabel={teacher?"Сохранить изменения":"Добавить педагога"}>
      <SInput label="Имя *" value={f.name} onChange={v=>s("name",v)} placeholder="Имя педагога" required/>
      {!teacher&&<SInput label="Email *" value={f.email} onChange={v=>s("email",v)} type="email" placeholder="teacher@example.com" required/>}
      <SSelect label="Роль" value={f.role} onChange={v=>s("role",v)} options={ROLE_OPTIONS}/>
      <div>
        <label style={{display:"block",fontSize:11,fontWeight:700,color:T.textSub,
          marginBottom:8,textTransform:"uppercase",letterSpacing:.7}}>Направления</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {DIRECTIONS.map(d=>(
            <button key={d} onClick={()=>td(d)} style={{
              border:`2px solid ${f.directions.includes(d)?T.accent:T.border}`,
              borderRadius:20,padding:"6px 14px",fontSize:13,fontWeight:600,cursor:"pointer",
              background:f.directions.includes(d)?T.accentLight:"transparent",
              color:f.directions.includes(d)?T.accent:T.textSub}}>{d}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function LinkModal({lessonId,contactName,messenger,onClose,onSend}) {
  const [link,setLink]=useState("");
  return (
    <Modal title="Отправить пропуск" onClose={onClose}
      onSave={()=>onSend(lessonId,link)} saveLabel={`Отправить через ${messenger}`}>
      <div style={{background:T.primaryLight,borderRadius:9,padding:"10px 12px",fontSize:13,marginBottom:14}}>
        Получатель: <strong>{contactName}</strong> · {messengerEmoji(messenger)} {messenger}
      </div>
      <SInput label="Ссылка-пропуск" value={link} onChange={setLink} placeholder="Вставьте ссылку из приложения комплекса"/>
      <div style={{background:T.muted,borderRadius:9,padding:"10px 12px",fontSize:12,color:T.textSub,lineHeight:1.6}}>
        <strong style={{color:T.textMain,display:"block",marginBottom:4}}>Текст сообщения:</strong>
        Добрый день! Напоминаем, что сегодня ждём вас на занятии в Азбуке Музыки. Ссылка для прохода: {link||"[вставьте ссылку]"}
      </div>
    </Modal>
  );
}

function LoginScreen({onLogin,error,loading}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",
      justifyContent:"center",padding:20,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"}}>
      <form onSubmit={e=>{e.preventDefault();onLogin(email,password);}}
        style={{width:"100%",maxWidth:340,background:T.surface,borderRadius:16,padding:24,
          boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
        <div style={{fontWeight:800,fontSize:18,marginBottom:18,textAlign:"center"}}>Азбука Музыки</div>
        <SInput label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" required/>
        <SInput label="Пароль" value={password} onChange={setPassword} type="password" placeholder="Пароль" required/>
        {error&&<div style={{background:T.dangerBg,color:T.danger,borderRadius:9,padding:"10px 12px",
          fontSize:13,marginBottom:13}}>{error}</div>}
        <Btn disabled={loading} style={{width:"100%",justifyContent:"center"}}
          onClick={e=>{e.preventDefault();onLogin(email,password);}}>
          {loading?"Входим…":"Войти"}
        </Btn>
      </form>
    </div>
  );
}

export default function App() {
  const [tab,setTab]           = useState("today");
  const [teachers,setTeachers] = useState([]);
  const [students,setStudents] = useState([]);
  const [subs,setSubs]         = useState([]);
  const [schedule,setSchedule] = useState([]);
  const [expenses,setExpenses] = useState([]);
  const [loading,setLoading]   = useState(true);
  const [loadError,setLoadError] = useState("");
  const [session,setSession]   = useState(null);
  const [me,setMe]             = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [authError,setAuthError]     = useState("");
  const [selStudentId,setSelStudentId] = useState(null);
  const [modals,setModals]     = useState({addStudent:false,editStudent:false,addSub:false,addLesson:false,addExpense:false});
  const [linkModal,setLinkModal] = useState(null);
  const [teacherModal,setTeacherModal] = useState(null);

  const resolveMe = async (sess) => {
    if (!sess) { setMe(null); return; }
    const { data } = await supabase.from("teachers").select("*").eq("auth_user_id", sess.user.id).single();
    if (!data) {
      setAuthError("Аккаунт не привязан к профилю преподавателя. Обратитесь к администратору.");
      await supabase.auth.signOut();
      setMe(null);
      return;
    }
    setMe(rowToTeacher(data));
  };

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data:{ session:sess } }) => {
      if (cancelled) return;
      setSession(sess);
      await resolveMe(sess);
      if (!cancelled) setAuthLoading(false);
    });
    const { data:sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (cancelled) return;
      setSession(sess);
      await resolveMe(sess);
      setAuthLoading(false);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const [loggingIn,setLoggingIn] = useState(false);
  const handleLogin = async (email,password) => {
    setLoggingIn(true); setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError("Неверный email или пароль");
    setLoggingIn(false);
  };
  const handleLogout = async () => { await supabase.auth.signOut(); };

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const [t,st,su,sc,ex] = await Promise.all([
        supabase.from("teachers").select("*").order("id"),
        supabase.from("students").select("*").order("id"),
        supabase.from("subscriptions").select("*").order("id"),
        supabase.from("schedule").select("*").order("id"),
        supabase.from("expenses").select("*").order("id"),
      ]);
      if (cancelled) return;
      const firstError = t.error||st.error||su.error||sc.error||ex.error;
      if (firstError) { setLoadError(firstError.message); setLoading(false); return; }
      setTeachers(t.data.map(rowToTeacher));
      setStudents(st.data.map(rowToStudent));
      setSubs(su.data.map(rowToSub));
      setSchedule(sc.data.map(rowToLesson));
      setExpenses(ex.data.map(rowToExpense));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const showModal=(k)=>setModals(p=>({...p,[k]:true}));
  const hideModal=(k)=>setModals(p=>({...p,[k]:false}));
  const selStudent  = students.find(s=>s.id===selStudentId);
  const selSubs     = selStudentId ? subs.filter(s=>s.studentId===selStudentId) : [];
  const selSchedule = selStudentId ? schedule.filter(l=>l.studentId===selStudentId) : [];

  const dbFail = (err) => { alert("Не удалось сохранить: "+err.message); };

  const addStudent = async (data) => {
    const { data:row, error } = await supabase.from("students").insert(studentToRow(data)).select().single();
    if (error) return dbFail(error);
    setStudents(p=>[...p, rowToStudent(row)]);
  };
  const updateStudent = async (id,data) => {
    const { error } = await supabase.from("students").update(studentToRow(data)).eq("id", id);
    if (error) return dbFail(error);
    setStudents(p=>p.map(s=>s.id===id?{...s,...data}:s));
  };
  const deleteStudent = async (id) => {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return dbFail(error);
    await Promise.all([
      supabase.from("subscriptions").delete().eq("student_id", id),
      supabase.from("schedule").delete().eq("student_id", id),
    ]);
    setStudents(p=>p.filter(s=>s.id!==id));
    setSubs(p=>p.filter(s=>s.studentId!==id));
    setSchedule(p=>p.filter(l=>l.studentId!==id));
    setSelStudentId(null);
  };
  const deleteSub = async (id) => {
    const { error } = await supabase.from("subscriptions").delete().eq("id", id);
    if (error) return dbFail(error);
    setSubs(p=>p.filter(s=>s.id!==id));
  };
  const deleteExpense = async (id) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return dbFail(error);
    setExpenses(p=>p.filter(e=>e.id!==id));
  };
  const addTeacher = async (data) => {
    const res = await fetch("/.netlify/functions/create-teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name:data.name, email:data.email, role:data.role, directions:data.directions }),
    });
    const body = await res.json().catch(()=>({}));
    if (!res.ok) { alert("Не удалось создать педагога: "+(body.error||res.statusText)); return; }
    setTeachers(p=>[...p, rowToTeacher(body.teacher)]);
    alert(`Педагог добавлен.\nEmail: ${body.teacher.email}\nВременный пароль: ${body.tempPassword}\n\nПередайте эти данные педагогу — пароль показывается только один раз.`);
  };
  const updateTeacher = async (id,data) => {
    const { error } = await supabase.from("teachers").update(teacherToRow(data)).eq("id", id);
    if (error) return dbFail(error);
    setTeachers(p=>p.map(t=>t.id===id?{...t,...data}:t));
  };
  const deleteTeacher = async (id) => {
    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) return dbFail(error);
    setTeachers(p=>p.filter(t=>t.id!==id));
  };
  const addSub = async (data) => {
    const type=SUB_TYPES.find(t=>t.key===data.typeKey);
    const sub={studentId:selStudentId,direction:data.direction,typeKey:data.typeKey,
      typeLabel:type.label,price:type.price,totalLessons:type.lessons,lessonsLeft:type.lessons,
      purchaseDate:today.toISOString(),expiryDate:addMonths(today,1).toISOString(),
      status:"active",paymentMethod:data.paymentMethod};
    const { data:row, error } = await supabase.from("subscriptions").insert(subToRow(sub)).select().single();
    if (error) return dbFail(error);
    setSubs(p=>[...p, rowToSub(row)]);
  };
  const markSubLesson = async (subId,status) => {
    const sub=subs.find(s=>s.id===subId); if(!sub) return;
    const lesson={studentId:selStudentId,teacherId:1,subId,direction:sub.direction,date:today.toISOString(),status,accessLink:""};
    const { data:row, error } = await supabase.from("schedule").insert(lessonToRow(lesson)).select().single();
    if (error) return dbFail(error);
    setSchedule(p=>[...p, rowToLesson(row)]);
    if(status==="attended"||status==="missed") {
      const lessonsLeft=Math.max(0,sub.lessonsLeft-1);
      const { error:subErr } = await supabase.from("subscriptions").update({lessons_left:lessonsLeft}).eq("id", subId);
      if (subErr) return dbFail(subErr);
      setSubs(p=>p.map(s=>s.id===subId?{...s,lessonsLeft}:s));
    }
  };
  const markLesson = async (lessonId,status) => {
    const lesson=schedule.find(l=>l.id===lessonId); if(!lesson) return;
    const { error } = await supabase.from("schedule").update({status}).eq("id", lessonId);
    if (error) return dbFail(error);
    setSchedule(p=>p.map(l=>l.id===lessonId?{...l,status}:l));
    if(status==="attended"||status==="missed") {
      const sub=subs.find(s=>s.id===lesson.subId);
      if (sub) {
        const lessonsLeft=Math.max(0,sub.lessonsLeft-1);
        const { error:subErr } = await supabase.from("subscriptions").update({lessons_left:lessonsLeft}).eq("id", sub.id);
        if (subErr) return dbFail(subErr);
        setSubs(p=>p.map(s=>s.id===lesson.subId?{...s,lessonsLeft}:s));
      }
    }
  };
  const sendLink = async (lessonId,link) => {
    if(lessonId) {
      const { error } = await supabase.from("schedule").update({access_link:link}).eq("id", lessonId);
      if (error) return dbFail(error);
      setSchedule(p=>p.map(l=>l.id===lessonId?{...l,accessLink:link}:l));
    }
    setLinkModal(null);
  };
  const openLink = (lessonId,contactName,messenger) => setLinkModal({lessonId,contactName,messenger});
  const addLesson = async (data) => {
    const lesson={studentId:data.studentId,teacherId:data.teacherId,subId:data.subId,
      direction:data.direction,date:`${data.date}T${data.time}:00`,status:"planned",accessLink:""};
    const { data:row, error } = await supabase.from("schedule").insert(lessonToRow(lesson)).select().single();
    if (error) return dbFail(error);
    setSchedule(p=>[...p, rowToLesson(row)]);
  };
  const addExpense = async (data) => {
    const expense={date:today.toISOString(),...data};
    const { data:row, error } = await supabase.from("expenses").insert(expenseToRow(expense)).select().single();
    if (error) return dbFail(error);
    setExpenses(p=>[...p, rowToExpense(row)]);
  };

  const isAdmin = me?.role==="admin";
  const tabCfg=[
    {key:"today",   label:"Сегодня",    icon:IC.today},
    {key:"students",label:"Ученики",    icon:IC.users},
    {key:"calendar",label:"Расписание", icon:IC.cal},
    ...(isAdmin?[{key:"finances",label:"Финансы", icon:IC.money}]:[]),
    {key:"teachers",label:"Педагоги",   icon:IC.teacher},
  ];
  const warnCount=subs.filter(s=>s.status==="active"&&s.lessonsLeft<=1).length;

  if (authLoading) {
    return (
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",
        justifyContent:"center",color:T.textSub,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"}}>
        Загрузка…
      </div>
    );
  }
  if (!session||!me) {
    return <LoginScreen onLogin={handleLogin} error={authError} loading={loggingIn}/>;
  }
  if (loading) {
    return (
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",
        justifyContent:"center",color:T.textSub,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"}}>
        Загрузка данных…
      </div>
    );
  }
  if (loadError) {
    return (
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",
        justifyContent:"center",padding:20,textAlign:"center",color:T.danger,
        fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"}}>
        Не удалось загрузить данные: {loadError}
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:T.bg,
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      color:T.textMain,maxWidth:480,margin:"0 auto",paddingBottom:selStudentId?0:72}}>

      {/* Чёрная шапка с логотипом */}
      {!selStudentId&&(
        <div style={{
          background: "#1A1A1A",
          borderBottom: "none",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <img src="/logo.png" alt="Азбука Музыки"
               style={{height: 44, objectFit: "contain"}}/>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {warnCount > 0 && (
              <div style={{background: "#C94A2A", color: "#fff",
                borderRadius: 20, padding: "4px 12px",
                fontSize: 12, fontWeight: 700}}>⚠ {warnCount}</div>
            )}
            <button onClick={handleLogout} style={{border:"none",background:"rgba(255,255,255,.12)",
              color:"#fff",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              Выйти
            </button>
          </div>
        </div>
      )}

      {selStudentId ? (
        <StudentDetail student={selStudent} subs={selSubs} schedule={selSchedule}
          teachers={teachers} onBack={()=>setSelStudentId(null)}
          onAddSub={()=>showModal("addSub")} onMarkSub={markSubLesson} onLink={openLink}
          onEdit={()=>showModal("editStudent")} onDelete={()=>deleteStudent(selStudentId)} onDeleteSub={deleteSub}/>
      ) : tab==="today" ? (
        <TodayScreen students={students} subs={subs} schedule={schedule} expenses={expenses}
          teachers={teachers} onMark={markLesson} onLink={openLink} onSelectStudent={setSelStudentId}/>
      ) : tab==="students" ? (
        <StudentsScreen students={students} subs={subs} onSelect={setSelStudentId} onAdd={()=>showModal("addStudent")}/>
      ) : tab==="calendar" ? (
        <CalendarScreen students={students} subs={subs} schedule={schedule} teachers={teachers}
          onMark={markLesson} onLink={openLink} onAddLesson={()=>showModal("addLesson")}/>
      ) : tab==="finances"&&isAdmin ? (
        <FinancesScreen subs={subs} schedule={schedule} expenses={expenses}
          onAddExpense={()=>showModal("addExpense")} onDeleteExpense={deleteExpense}/>
      ) : (
        <TeachersScreen teachers={teachers} isAdmin={isAdmin}
          onAdd={()=>setTeacherModal({mode:"add"})}
          onEdit={(t)=>setTeacherModal({mode:"edit",teacher:t})}
          onDelete={deleteTeacher}/>
      )}

      {!selStudentId&&(
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
          width:"100%",maxWidth:480,background:T.surface,borderTop:`1px solid ${T.border}`,
          display:"flex",zIndex:100}}>
          {tabCfg.map(item=>(
            <button key={item.key} onClick={()=>setTab(item.key)} style={{
              flex:1,border:"none",background:"none",padding:"10px 0 12px",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              color:tab===item.key?T.accent:T.textSub,
              borderTop:tab===item.key?`2px solid ${T.accent}`:"2px solid transparent"}}>
              {item.icon}
              <span style={{fontSize:9,fontWeight:tab===item.key?700:400,letterSpacing:.2}}>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {modals.addStudent&&<AddStudentModal onClose={()=>hideModal("addStudent")} onSave={d=>{addStudent(d);hideModal("addStudent");}}/>}
      {modals.editStudent&&selStudentId&&<EditStudentModal student={selStudent} onClose={()=>hideModal("editStudent")} onSave={d=>{updateStudent(selStudentId,d);hideModal("editStudent");}}/>}
      {modals.addSub&&selStudentId&&<AddSubModal student={selStudent} onClose={()=>hideModal("addSub")} onSave={d=>{addSub(d);hideModal("addSub");}}/>}
      {modals.addLesson&&<AddLessonModal students={students} teachers={teachers} subs={subs} onClose={()=>hideModal("addLesson")} onSave={d=>{addLesson(d);hideModal("addLesson");}}/>}
      {modals.addExpense&&<AddExpenseModal onClose={()=>hideModal("addExpense")} onSave={d=>{addExpense(d);hideModal("addExpense");}}/>}
      {linkModal&&<LinkModal {...linkModal} onClose={()=>setLinkModal(null)} onSend={sendLink}/>}
      {teacherModal&&<TeacherModal teacher={teacherModal.teacher} onClose={()=>setTeacherModal(null)}
        onSave={d=>{teacherModal.mode==="edit"?updateTeacher(teacherModal.teacher.id,d):addTeacher(d);setTeacherModal(null);}}/>}
    </div>
  );
}