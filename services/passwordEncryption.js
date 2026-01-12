const crypto = require('crypto');

// ==================== ENCRYPT SCRIPT =====================

const encryptPassword = async (username, password, uuid) => {
  const res = await encrypt(username, password, uuid);
  return {
    message: `=== REPLACE PASSWORD IN TCLMUSER TABLE WITH THIS NEW PASSWORD ===\n` +
      `UUID: ${uuid}\nUsername: ${username}\nPassword: ${password}\n\n${res}`,
    hash: res,
  };
};

const encrypt = async (username, password, uidd) => {
  const salting = `5unf15h${username}D4740N`;
  const pwdHash = getHash(password, salting, 7).toUpperCase();

  const salt = username + '@' + uidd;
  const key = salt.split('').reverse().join('');

  let strhash = crypto.createHash('sha512').update(pwdHash + key, 'utf8').digest('hex').toUpperCase();
  for (let i = 1; i <= 1024; i++) {
    strhash = crypto.createHash('sha512').update(strhash + key, 'utf8').digest('hex').toUpperCase();
    await unblockEventLoop();
  }
  return strhash;
};

const getHash = (msg, salt, itr) => {
  let strmsg;
  if (itr === 0) {
    strmsg = hash(msg, true);
    const arMsg = [
      strmsg.substr(0, 4),
      strmsg.substr(4, strmsg.length - 8),
      strmsg.substr(strmsg.length - 4, 4),
    ];
    strmsg = arMsg[0].split('').reverse().join('') +
      arMsg[1].split('').reverse().join('') +
      arMsg[2].split('').reverse().join('');
  } else {
    salt = salt.split('').reverse().join('');
    strmsg = hash(msg + salt, true);
    for (let i = 1; i < itr; i++) {
      strmsg = hash(strmsg + salt, true);
    }
  }
  return strmsg;
};

const hash = (msg, utf8encode, tcase) => {
  utf8encode = utf8encode ?? true;
  if (tcase == null) tcase = 2;
  if (utf8encode) msg = encode(msg);

  const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];

  msg += String.fromCharCode(0x80);

  const l = msg.length / 4 + 2;
  const N = Math.ceil(l / 16);
  const M = Array.from({ length: N }, () => new Array(16));

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < 16; j++) {
      M[i][j] =
        (msg.charCodeAt(i * 64 + j * 4) << 24) |
        (msg.charCodeAt(i * 64 + j * 4 + 1) << 16) |
        (msg.charCodeAt(i * 64 + j * 4 + 2) << 8) |
        msg.charCodeAt(i * 64 + j * 4 + 3);
    }
  }

  M[N - 1][14] = Math.floor(((msg.length - 1) * 8) / Math.pow(2, 32));
  M[N - 1][15] = ((msg.length - 1) * 8) & 0xffffffff;

  let H0 = 0x67452301;
  let H1 = 0xefcdab89;
  let H2 = 0x98badcfe;
  let H3 = 0x10325476;
  let H4 = 0xc3d2e1f0;

  const W = new Array(80);
  for (let i = 0; i < N; i++) {
    for (let t = 0; t < 16; t++) W[t] = M[i][t];
    for (let t = 16; t < 80; t++)
      W[t] = ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);

    let a = H0, b = H1, c = H2, d = H3, e = H4;

    for (let t = 0; t < 80; t++) {
      const s = Math.floor(t / 20);
      const T = (ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[t]) & 0xffffffff;
      e = d;
      d = c;
      c = ROTL(b, 30);
      b = a;
      a = T;
    }

    H0 = (H0 + a) & 0xffffffff;
    H1 = (H1 + b) & 0xffffffff;
    H2 = (H2 + c) & 0xffffffff;
    H3 = (H3 + d) & 0xffffffff;
    H4 = (H4 + e) & 0xffffffff;
  }

  let vhash =
    toHexStr(H0) +
    toHexStr(H1) +
    toHexStr(H2) +
    toHexStr(H3) +
    toHexStr(H4);

  if (tcase === 1) vhash = vhash.toLowerCase();
  if (tcase === 2) vhash = vhash.toUpperCase();

  return vhash;
};

const encode = (strUni) => {
  strUni = strUni.toString();
  let strUtf = strUni.replace(/[\u0080-\u07ff]/g, (c) => {
    const cc = c.charCodeAt(0);
    return String.fromCharCode(0xc0 | (cc >> 6), 0x80 | (cc & 0x3f));
  });
  strUtf = strUtf.replace(/[\u0800-\uffff]/g, (c) => {
    const cc = c.charCodeAt(0);
    return String.fromCharCode(
      0xe0 | (cc >> 12),
      0x80 | ((cc >> 6) & 0x3f),
      0x80 | (cc & 0x3f)
    );
  });
  return strUtf;
};

const ROTL = (x, n) => (x << n) | (x >>> (32 - n));

const f = (s, x, y, z) => {
  switch (s) {
    case 0: return (x & y) ^ (~x & z);
    case 1: return x ^ y ^ z;
    case 2: return (x & y) ^ (x & z) ^ (y & z);
    case 3: return x ^ y ^ z;
  }
};

const toHexStr = (n) => {
  let s = '';
  for (let i = 7; i >= 0; i--) {
    const v = (n >>> (i * 4)) & 0xf;
    s += v.toString(16);
  }
  return s;
};

const unblockEventLoop = () => new Promise(resolve => setImmediate(resolve));

module.exports = { encryptPassword };
