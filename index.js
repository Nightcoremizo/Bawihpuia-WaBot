const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req,res)=>res.send('BPAWABot AI Running'));
app.listen(PORT, ()=>console.log("Server "+PORT));

const OWNER = "919233092990";
const COIN_FILE = './coins.json';
let coins = fs.existsSync(COIN_FILE) ? JSON.parse(fs.readFileSync(COIN_FILE)) : {};
let lastDaily = {};
const save = () => fs.writeFileSync(COIN_FILE, JSON.stringify(coins));
const getCoin = (jid) => { let n=jid.split('@')[0].split(':')[0]; if(!coins[n]){coins[n]=100; save();} return coins[n]; }
const addCoin = (jid,a) => { let n=jid.split('@')[0].split(':')[0]; if(!coins[n])coins[n]=0; coins[n]+=a; save(); }
const cutCoin = (jid,a) => { let n=jid.split('@')[0].split(':')[0]; if(getCoin(jid)<a) return false; coins[n]-=a; save(); return true; }

async function askAI(prompt, name){
  try{
    let res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(`You are BPAWABot created by Bawihpuia. Reply in Mizo mixed English friendly. User name ${name}. Q: ${prompt}`)}`, {timeout:15000});
    return res.data;
  }catch{ return "AI buai rih, Bawihpuia bot ka ni!"; }
}
async function dlIG(url){
  try{
    let r = await axios.post('https://api.lovetik.com/api/ajax/search',
      new URLSearchParams({q:url, t:'media', lang:'en'}),
      {headers:{'Content-Type':'application/x-www-form-urlencoded'}}
    );
    return r.data?.links?.[0]?.a || r.data?.links?.[0]?.link;
  }catch{ return null; }
}

async function startBot(){
  const {state, saveCreds} = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth:state, logger:P({level:'silent'}), printQRInTerminal:false, browser:["BPAWABot","Chrome","3.0"] });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u)=>{
    console.log("Connection:", u.connection);
    if(u.connection==='open') console.log('BPAWABot Connected!');
    if(u.connection==='close'){
      console.log("Close, reconnecting in 5s...");
      setTimeout(startBot, 5000);
    }
  });

  // PAIRING WITH RETRY - FIXED
  if(!sock.authState.creds.registered){
    const getCode = async () => {
      try{
        await new Promise(r=>setTimeout(r,8000));
        let code = await sock.requestPairingCode(OWNER);
        console.log(`\n\n=== PAIRING CODE FOR ${OWNER} : ${code} ===\nWhatsApp > Linked Devices > Link with phone number > Type this code\n\n`);
      }catch(e){ 
        console.log("Pairing retry... ", e.message);
        setTimeout(getCode, 12000);
      }
    };
    getCode();
  }

  sock.ev.on('messages.upsert', async m=>{
    const msg = m.messages[0];
    if(!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const senderJid = isGroup ? (msg.key.participant || msg.participant) : from;
    const senderNum = senderJid.split('@')[0];
    const senderName = msg.pushName || senderNum;
    const isOwner = senderNum.includes(OWNER);

    // OnceView Auto Open
    let vo = msg.message.viewOnceMessage || msg.message.viewOnceMessageV2 || msg.message.viewOnceMessageV2Extension;
    if(vo){
      try{
        let buf = await downloadMediaMessage(msg,'buffer',{},{logger:P({level:'silent'}), reuploadRequest:sock.updateMediaMessage});
        if(buf){
          await sock.sendMessage(from, { image: buf, caption: `🔓 Once View Opened\nBy: ${senderName} (${senderNum})\nCoin: ${getCoin(senderJid)}` });
          if(!isOwner) cutCoin(senderJid,10);
          return;
        }
      }catch(e){ console.log("once err", e.message); }
    }

    let text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
    text = text.trim();
    if(!text) return;
    let low = text.toLowerCase();

    // Auto IG
    if(text.includes('instagram.com')){
      let link = text.match(/https?:\/\/www\.instagram\.com[^\s]+/);
      if(link){
        if(!isOwner){
          if(getCoin(senderJid)<10){ await sock.sendMessage(from,{text:`❌ Coin tlem! ${getCoin(senderJid)}\n*daily* ti rawh`}); return; }
          cutCoin(senderJid,10);
        }
        await sock.sendMessage(from,{text:`⏳ Igvid download... By ${senderName}`});
        let dl = await dlIG(link[0]);
        if(dl) await sock.sendMessage(from,{video:{url:dl}, caption:`✅ Igvid\nBy: ${senderName}\nCoin: ${getCoin(senderJid)}`});
        else await sock.sendMessage(from,{text:"❌ Download fail"});
        return;
      }
    }

    if(low==='menu'){
      await sock.sendMessage(from,{text:`🤖 *BPAWABot Menu*\nBy: Bawihpuia\n\n👤 Nang: ${senderName}\n📱 ${senderNum}\n💰 Coin: ${getCoin(senderJid)}\n\n• menu\n• creator\n• coin\n• daily (1000 per 24h)\n• igvid <link>\n• transfer <number> <amt>\n  Ex: transfer ${OWNER} 100\n• /AI <zawhna>\n  Ex: /AI hello\n  Ex: /AI transfer engtin?\n\nAuto: IG link & OnceView`}); return;
    }
    if(low==='creator'){ await sock.sendMessage(from,{text:`👑 Creator: Bawihpuia\nBot: BPAWABot\nUser: ${senderName}`}); return; }
    if(low==='coin'||low==='coins'){ await sock.sendMessage(from,{text:`💰 ${senderName} Coin: ${getCoin(senderJid)}`}); return; }
    if(low==='daily'){
      let last=lastDaily[senderNum]||0;
      if(Date.now()-last < 86400000){
        let h=Math.ceil((86400000-(Date.now()-last))/3600000);
        await sock.sendMessage(from,{text:`⏳ ${h}h la awm. Coin: ${getCoin(senderJid)}`}); return;
      }
      lastDaily[senderNum]=Date.now();
      addCoin(senderJid,1000);
      await sock.sendMessage(from,{text:`✅ Daily +1000! Total: ${getCoin(senderJid)}`}); return;
    }
    if(low.startsWith('sept20')){
      if(!isOwner){ await sock.sendMessage(from,{text:"❌ Owner chauh"}); return; }
      let amt=parseInt(text.split(' ')[1]);
      if(!amt){ await sock.sendMessage(from,{text:"Ex: sept20 5000"}); return; }
      addCoin(senderJid,amt);
      await sock.sendMessage(from,{text:`✅ ${amt} added! Total: ${getCoin(senderJid)}`}); return;
    }
    if(low.startsWith('transfer')){
      let p=text.split(' ');
      if(p.length<3){ await sock.sendMessage(from,{text:"Ex: transfer 919233092990 100"}); return; }
      let target=p[1].replace(/[^0-9]/g,''); let amt=parseInt(p[2]);
      if(!amt || getCoin(senderJid)<amt){ await sock.sendMessage(from,{text:`Coin tlem! ${getCoin(senderJid)}`}); return; }
      cutCoin(senderJid,amt);
      if(!coins[target]) coins[target]=0; coins[target]+=amt; save();
      await sock.sendMessage(from,{text:`✅ ${amt} to ${target} done! Bang: ${getCoin(senderJid)}\nBy: ${senderName}`});
      try{ await sock.sendMessage(target+'@s.whatsapp.net',{text:`💸 ${senderName} in ${amt} coin a thawn che! Total: ${coins[target]}`}); }catch{}
      return;
    }
    if(low.startsWith('igvid')){
      if(!isOwner && getCoin(senderJid)<10){ await sock.sendMessage(from,{text:`Coin tlem!`}); return; }
      if(!isOwner) cutCoin(senderJid,10);
      let link=text.split(' ')[1] || text.match(/https?:\/\/[^\s]+/)?.[0];
      if(!link){ await sock.sendMessage(from,{text:"Ex: igvid https://instagram.com/reel/..."}); return; }
      let dl=await dlIG(link);
      if(dl) await sock.sendMessage(from,{video:{url:dl}, caption:`✅ By ${senderName}`});
      else await sock.sendMessage(from,{text:"❌ Fail"}); return;
    }
    if(low.startsWith('/ai')){
      let prompt=text.slice(3).trim();
      if(!prompt){ await sock.sendMessage(from,{text:"Ex: /AI hello"}); return; }
      if(!isOwner){
        if(getCoin(senderJid)<10){ await sock.sendMessage(from,{text:`Coin tlem! ${getCoin(senderJid)}`}); return; }
        cutCoin(senderJid,10);
      }
      await sock.sendMessage(from,{text:`🤖 AI ngaihtuah mek... By ${senderName}`});
      let ans=await askAI(prompt, senderName);
      await sock.sendMessage(from,{text:`🤖 *BPAWABot AI*\nQ: ${prompt}\nBy: ${senderName}\n\nA: ${ans}\n\n💰 ${getCoin(senderJid)}`});
      return;
    }
  });
}
startBot();
