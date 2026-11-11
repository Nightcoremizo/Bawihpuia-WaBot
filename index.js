const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req,res)=>res.send('BPAWABot AI Running'));
app.listen(PORT, ()=>console.log(PORT));

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
    // FREE AI - Pollinations
    let res = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(`You are BPAWABot created by Bawihpuia. You are friendly, helpful, Mizo tawng thiam. User name is ${name}. Question: ${prompt}`)}`, { timeout: 15000 });
    return res.data;
  }catch(e){ return "AI buai rih, mahse Bawihpuia siam ka ni e!"; }
}

async function dlIG(url){
  try{
    let r = await axios.post('https://api.lovetik.com/api/ajax/search',
      new URLSearchParams({q:url, t:'media', lang:'en'}),
      {headers:{'Content-Type':'application/x-www-form-urlencoded'}}
    );
    return r.data?.links?.[0]?.a || r.data?.links?.[0]?.link || r.data?.medias?.[0]?.url;
  }catch{ return null; }
}

async function startBot(){
  const {state, saveCreds} = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth:state, logger:P({level:'silent'}), printQRInTerminal:false, browser:["BPAWABot","Chrome","3.0"] });

  // NUMBER TYPE CHAWP NGAI PAIRING
  if(!sock.authState.creds.registered){
    setTimeout(async()=>{
      try{
        let code = await sock.requestPairingCode(OWNER);
        console.log(`\n\n=== PAIRING CODE FOR ${OWNER} : ${code} ===\nPaste in WhatsApp > Linked Devices > Link with phone number instead\n\n`);
      }catch(e){ console.log("Pairing err", e.message); }
    },6000);
  }

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', u=>{ if(u.connection==='open')console.log('Connected!'); });

  sock.ev.on('messages.upsert', async m=>{
    const msg = m.messages[0];
    if(!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const senderJid = isGroup ? (msg.key.participant || msg.participant) : from;
    const senderNum = senderJid.split('@')[0];
    const senderName = msg.pushName || senderNum;
    const isOwner = senderNum.includes(OWNER);

    let text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
    text = text.trim();
    if(!text) {
      // Once View check
      let vo = msg.message.viewOnceMessage || msg.message.viewOnceMessageV2;
      if(vo){
        try{
          let buf = await downloadMediaMessage(msg,'buffer',{},{logger:P({level:'silent'}), reuploadRequest:sock.updateMediaMessage});
          await sock.sendMessage(from, { image: buf, caption: `🔓 *Once View Opened*\nBy: ${senderName} (${senderNum})\nBot: BPAWABot` });
          if(!isOwner) cutCoin(senderJid,10);
        }catch{}
      }
      return;
    }

    let low = text.toLowerCase();

    // AUTO IGVID
    if(text.includes('instagram.com')){
      let link = text.match(/https?:\/\/www\.instagram\.com[^\s]+/);
      if(link){
        if(!isOwner && !cutCoin(senderJid,10)){ await sock.sendMessage(from,{text:`❌ Coin tlem! Coin: ${getCoin(senderJid)}\n*daily* ti rawh.`}); return; }
        await sock.sendMessage(from,{text:`⏳ Igvid download... Request by ${senderName}`});
        let dl = await dlIG(link[0]);
        if(dl) await sock.sendMessage(from,{video:{url:dl}, caption:`✅ Igvid Done\nBy: ${senderName}\nCoin: ${getCoin(senderJid)}`});
        else await sock.sendMessage(from,{text:"❌ Download theih loh."});
        return;
      }
    }

    // COIN CHECK - command tin ah 10 cut (owner free)
    function needCoin(){
      if(isOwner) return true;
      if(getCoin(senderJid)<10){ sock.sendMessage(from,{text:`❌ Coin tlem! I coin: ${getCoin(senderJid)}\n*daily* ti la 1000 i hmu ang.`}); return false; }
      cutCoin(senderJid,10); return true;
    }

    if(low==='menu'){
      let menu=`🤖 *BPAWABot Menu*
By: Bawihpuia

👤 Nang: ${senderName}
📱 Number: ${senderNum}
💰 Coin: ${getCoin(senderJid)}

*COMMAND:*
• menu - Menu
• creator - Siamtu
• coin - Coin en
• daily - 24h dan a 1000 claim
• igvid <link> - IG video download
• transfer <number> <amount>
  Ex: transfer ${OWNER} 100
• /AI <zawhna> - Meta ang a biak theih AI
  Ex: /AI hello
  Ex: /AI transfer engtin nge?
  Ex: /AI igvid

Owner:
• sept20 <amount>
  Ex: sept20 10000

Auto:
• IG link i dah chuan ka lo download ang
• Once view thlalak ka lo hawng ang`;
      await sock.sendMessage(from,{text:menu}); return;
    }

    if(low==='creator'){ await sock.sendMessage(from,{text:`👑 Creator: Bawihpuia\nBot: BPAWABot\nOwner: +${OWNER}\nUser: ${senderName}`}); return; }
    if(low==='coin' || low==='coins'){ await sock.sendMessage(from,{text:`💰 ${senderName} Coin: ${getCoin(senderJid)}`}); return; }

    if(low==='daily'){
      let last=lastDaily[senderNum]||0;
      if(Date.now()-last < 24*60*60*1000){
        let h=Math.ceil((24*60*60*1000-(Date.now()-last))/3600000);
        await sock.sendMessage(from,{text:`⏳ ${h}h la awm. Coin: ${getCoin(senderJid)}`}); return;
      }
      lastDaily[senderNum]=Date.now();
      addCoin(senderJid,1000);
      await sock.sendMessage(from,{text:`✅ Daily +1000!\nTunah: ${getCoin(senderJid)}`}); return;
    }

    if(low.startsWith('sept20')){
      if(!isOwner){ await sock.sendMessage(from,{text:"❌ Owner chauh."}); return; }
      let amt=parseInt(text.split(' ')[1]);
      if(!amt){ await sock.sendMessage(from,{text:"Ex: sept20 5000"}); return; }
      addCoin(senderJid,amt);
      await sock.sendMessage(from,{text:`✅ ${amt} coin add!\nTotal: ${getCoin(senderJid)}`}); return;
    }

    if(low.startsWith('transfer')){
      if(!needCoin()) return;
      let p=text.split(' ');
      if(p.length<3){ await sock.sendMessage(from,{text:"Ex: transfer 919233092990 100"}); return; }
      let target=p[1].replace(/[^0-9]/g,'');
      let amt=parseInt(p[2]);
      if(!amt || getCoin(senderJid)<amt){ await sock.sendMessage(from,{text:`Coin tlem! I coin: ${getCoin(senderJid)}`}); return; }
      cutCoin(senderJid,amt);
      if(!coins[target]) coins[target]=0; coins[target]+=amt; save();
      await sock.sendMessage(from,{text:`✅ ${amt} coin ${target} hnen ah transfer!\nI bang: ${getCoin(senderJid)}\nBy: ${senderName}`});
      try{ await sock.sendMessage(target+'@s.whatsapp.net',{text:`💸 ${senderName} in ${amt} coin a rawn thawn che!\nI coin: ${getCoin(target+'@s.whatsapp.net')}`}); }catch{}
      return;
    }

    if(low.startsWith('igvid')){
      if(!needCoin()) return;
      let link=text.split(' ')[1] || text.match(/https?:\/\/[^\s]+/)?.[0];
      if(!link){ await sock.sendMessage(from,{text:"Ex: igvid https://www.instagram.com/reel/..."}); return; }
      let dl=await dlIG(link);
      if(dl) await sock.sendMessage(from,{video:{url:dl}, caption:`✅ Igvid\nBy: ${senderName} (${senderNum})`});
      else await sock.sendMessage(from,{text:"❌ Fail."});
      return;
    }

    // /AI COMMAND - Meta ang chiah
    if(low.startsWith('/ai')){
      if(!needCoin()) return;
      let prompt=text.slice(3).trim();
      if(!prompt){ await sock.sendMessage(from,{text:"Hman dan: /AI hello\n/AI transfer engtin?\n/AI igvid"}); return; }
      await sock.sendMessage(from,{text:`🤖 BPAWABot AI ngaihtuah mek...\nBy: ${senderName}`});
      let ans=await askAI(prompt, senderName);
      await sock.sendMessage(from,{text:`🤖 *BPAWABot AI*\nBy Bawihpuia\n\nUser: ${senderName}\nQ: ${prompt}\n\nA: ${ans}\n\n💰 Coin: ${getCoin(senderJid)}`});
      return;
    }

  });
}
startBot();
