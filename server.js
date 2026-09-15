const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data.json");
const ENV = process.env;
const RAZORPAY_KEY_ID = ENV.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = ENV.RAZORPAY_KEY_SECRET || "";
const GOOGLE_MAPS_KEY = ENV.GOOGLE_MAPS_KEY || "";
const MSG91_SEND_URL = ENV.MSG91_SEND_URL || "";
const MSG91_VERIFY_URL = ENV.MSG91_VERIFY_URL || "";
const MSG91_AUTHKEY = ENV.MSG91_AUTHKEY || "";
const MSG91_TEMPLATE_ID = ENV.MSG91_TEMPLATE_ID || "";
const PUBLIC_BASE_URL = ENV.PUBLIC_BASE_URL || "";

const defaultData = {
  users: [],
  sessions: {},
  rides: [],
  wallets: {},
  savedPlaces: {},
  otps: {}
};

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA, "utf8")); }
  catch { return JSON.parse(JSON.stringify(defaultData)); }
}
let db = loadData();

function saveData() {
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2));
}
function json(res, code, value) {
  const body = JSON.stringify(value);
  res.writeHead(code, {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    let raw="";
    req.on("data", c => {
      raw += c;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on("end", ()=>{
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error",reject);
  });
}
function token() { return crypto.randomBytes(24).toString("hex"); }
function id(prefix) { return prefix + "-" + crypto.randomBytes(4).toString("hex").toUpperCase(); }
function getToken(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}
function userFrom(req) {
  const t = getToken(req);
  return t && db.sessions[t] ? db.users.find(u=>u.id===db.sessions[t]) : null;
}
function requireUser(req,res) {
  const u = userFrom(req);
  if (!u) { json(res,401,{ok:false,error:"Login required"}); return null; }
  return u;
}
function cleanUser(u) { return {id:u.id,name:u.name,phone:u.phone,email:u.email||""}; }

function serveStatic(req,res) {
  let pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (pathname === "/") pathname="/index.html";
  const file = path.normalize(path.join(PUBLIC, pathname));
  if (!file.startsWith(PUBLIC)) return json(res,403,{ok:false,error:"Forbidden"});
  fs.readFile(file,(err,data)=>{
    if (err) return json(res,404,{ok:false,error:"Not found"});
    const ext=path.extname(file);
    const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
    res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream"});
    res.end(data);
  });
}

async function api(req,res) {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  const method = req.method;

  if (method==="GET" && p==="/api/health") return json(res,200,{ok:true,service:"SUBHA RIDE",time:new Date().toISOString(),production:{razorpay:!!RAZORPAY_KEY_ID,googleMaps:!!GOOGLE_MAPS_KEY,msg91:!!MSG91_SEND_URL}});
  if (method==="GET" && p==="/api/config") return json(res,200,{ok:true,googleMapsKey:GOOGLE_MAPS_KEY,razorpayKeyId:RAZORPAY_KEY_ID});

  if (method==="POST" && p==="/api/auth/request-otp") {
    const b=await readBody(req);
    const phone=String(b.phone||"").trim();
    if (!/^[0-9+ -]{7,20}$/.test(phone)) return json(res,400,{ok:false,error:"Enter a valid phone number"});
    if (MSG91_SEND_URL) {
      const payload={mobile:phone,template_id:MSG91_TEMPLATE_ID};
      const r=await fetch(MSG91_SEND_URL,{method:"POST",headers:{"Content-Type":"application/json","authkey":MSG91_AUTHKEY},body:JSON.stringify(payload)});
      if(!r.ok) return json(res,502,{ok:false,error:"OTP provider rejected the request"});
      db.otps[phone]={provider:"msg91",expires:Date.now()+5*60*1000};
      saveData();
      return json(res,200,{ok:true,message:"OTP sent"});
    }
    const code = String(Math.floor(100000+Math.random()*900000));
    db.otps[phone]={code,expires:Date.now()+5*60*1000};
    saveData();
    return json(res,200,{ok:true,message:"Development OTP generated",demoOtp:code});
  }

  if (method==="POST" && p==="/api/auth/verify-otp") {
    const b=await readBody(req);
    const phone=String(b.phone||"").trim(), code=String(b.code||"").trim();
    const rec=db.otps[phone];
    if (!rec || Date.now()>rec.expires) return json(res,401,{ok:false,error:"Invalid or expired OTP"});
    if (rec.provider==="msg91") {
      if (!MSG91_VERIFY_URL) return json(res,500,{ok:false,error:"MSG91 verify URL is not configured"});
      const verifyUrl=MSG91_VERIFY_URL + (MSG91_VERIFY_URL.includes("?")?"&":"?") + "mobile=" + encodeURIComponent(phone) + "&otp=" + encodeURIComponent(code);
      const vr=await fetch(verifyUrl,{headers:{authkey:MSG91_AUTHKEY}});
      const vd=await vr.json().catch(()=>({}));
      const ok=vr.ok && (vd.type==="success" || vd.status==="success" || vd.message==="success" || vd.success===true);
      if(!ok) return json(res,401,{ok:false,error:"Invalid or expired OTP"});
    } else if (!rec.code || rec.code!==code) {
      return json(res,401,{ok:false,error:"Invalid or expired OTP"});
    }
    let u=db.users.find(x=>x.phone===phone);
    if (!u) { u={id:id("USR"),name:String(b.name||"Customer"),phone,email:""}; db.users.push(u); db.wallets[u.id]=0; db.savedPlaces[u.id]=[]; }
    const t=token(); db.sessions[t]=u.id; delete db.otps[phone]; saveData();
    return json(res,200,{ok:true,token:t,user:cleanUser(u),wallet:db.wallets[u.id]||0});
  }

  if (method==="GET" && p==="/api/me") {
    const u=requireUser(req,res); if(!u)return;
    return json(res,200,{ok:true,user:cleanUser(u),wallet:db.wallets[u.id]||0});
  }

  if (method==="POST" && p==="/api/logout") {
    const t=getToken(req); if(t) delete db.sessions[t]; saveData(); return json(res,200,{ok:true});
  }

  if (method==="POST" && p==="/api/payments/order") {
    const u=requireUser(req,res); if(!u)return;
    if(!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return json(res,503,{ok:false,error:"Razorpay is not configured"});
    const b=await readBody(req);
    const amount=Math.round(Number(b.amount||0)*100);
    if(!Number.isFinite(amount)||amount<100) return json(res,400,{ok:false,error:"Minimum payment is ₹1"});
    const auth=Buffer.from(RAZORPAY_KEY_ID+":"+RAZORPAY_KEY_SECRET).toString("base64");
    const rr=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{Authorization:"Basic "+auth,"Content-Type":"application/json"},body:JSON.stringify({amount,currency:"INR",receipt:id("RCPT"),notes:{userId:u.id}})});
    const data=await rr.json().catch(()=>({}));
    if(!rr.ok) return json(res,502,{ok:false,error:data.error?.description||"Unable to create payment order"});
    return json(res,200,{ok:true,order:data,keyId:RAZORPAY_KEY_ID});
  }

  if (method==="POST" && p==="/api/payments/verify") {
    const u=requireUser(req,res); if(!u)return;
    if(!RAZORPAY_KEY_SECRET) return json(res,503,{ok:false,error:"Razorpay is not configured"});
    const b=await readBody(req);
    const expected=crypto.createHmac("sha256",RAZORPAY_KEY_SECRET).update(String(b.orderId)+"|"+String(b.paymentId)).digest("hex");
    if(expected!==String(b.signature)) return json(res,400,{ok:false,error:"Payment signature verification failed"});
    const amount=Number(b.amount||0);
    if(!Number.isFinite(amount)||amount<=0) return json(res,400,{ok:false,error:"Invalid amount"});
    db.wallets[u.id]=(db.wallets[u.id]||0)+amount; saveData();
    return json(res,200,{ok:true,balance:db.wallets[u.id]});
  }

  if (method==="GET" && p==="/api/rides") {
    const u=requireUser(req,res); if(!u)return;
    return json(res,200,{ok:true,rides:db.rides.filter(r=>r.userId===u.id).sort((a,b)=>b.createdAt-a.createdAt)});
  }

  if (method==="POST" && p==="/api/rides") {
    const u=requireUser(req,res); if(!u)return;
    const b=await readBody(req);
    if(!b.pickup || !b.drop) return json(res,400,{ok:false,error:"Pickup and drop are required"});
    const vehicle=b.vehicle==="tempo"?"Tempo / Mini":"Mini Truck";
    const base=vehicle==="Mini Truck"?650:450;
    const distance=Number(b.distance)||12;
    const estimate=base+Math.max(0,distance-5)*18;
    const discount=b.coupon==="SUBHA50"?50:0;
    const ride={id:id("SR"),userId:u.id,pickup:String(b.pickup),drop:String(b.drop),vehicle,distance,estimatedMinutes:35,fare:Math.max(0,estimate-discount),status:"Searching driver",createdAt:Date.now()};
    db.rides.push(ride); saveData(); return json(res,201,{ok:true,ride});
  }

  if (method==="GET" && p==="/api/wallet") {
    const u=requireUser(req,res); if(!u)return;
    return json(res,200,{ok:true,balance:db.wallets[u.id]||0});
  }

  if (method==="POST" && p==="/api/wallet/demo-topup") {
    const u=requireUser(req,res); if(!u)return;
    db.wallets[u.id]=(db.wallets[u.id]||0)+500; saveData();
    return json(res,200,{ok:true,balance:db.wallets[u.id]});
  }

  if (method==="GET" && p==="/api/saved-places") {
    const u=requireUser(req,res); if(!u)return;
    return json(res,200,{ok:true,places:db.savedPlaces[u.id]||[]});
  }

  if (method==="POST" && p==="/api/saved-places") {
    const u=requireUser(req,res); if(!u)return;
    const b=await readBody(req);
    if(!b.name || !b.address) return json(res,400,{ok:false,error:"Name and address are required"});
    const places=db.savedPlaces[u.id]||[];
    const place={id:id("PLC"),name:String(b.name),address:String(b.address),lat:b.lat??null,lng:b.lng??null};
    places.push(place); db.savedPlaces[u.id]=places; saveData();
    return json(res,201,{ok:true,place});
  }

  return json(res,404,{ok:false,error:"API route not found"});
}

const server=http.createServer(async(req,res)=>{
  try {
    if ((req.headers.accept||"").includes("text/html") && req.url.startsWith("/api/")) {}
    if (req.url.startsWith("/api/")) await api(req,res);
    else serveStatic(req,res);
  } catch(e) {
    console.error(e);
    json(res,500,{ok:false,error:"Server error"});
  }
});
server.listen(PORT,()=>console.log(`SUBHA RIDE running at http://localhost:${PORT}`));
