/**
 * Created by AshZhang on 2015/9/10.
 */


'use strict';

var bodyParser = require('body-parser'),
    crypto = require('crypto'),
    express = require('express'),
    https = require('https'),
    wechat = require('wechat'),
    app = express(),

    AES_KEY = 'hUvnrPEdu47fGIZHbBDHf4kpvKZqNpoIH5pkCOu2p4I',
    APP_ID = 'wx830723309171d417',
    APP_SECRET = '92c29e0aca67bc0f3a6a45d3fd0d21fc',
    TOKEN = 'BurnToAshes',
    NONCE_STR = 'Ash',

    // 配置
    config = {
      token         : TOKEN,
      appid         : APP_ID,
      encodingAESKey: AES_KEY
    },

    // 全局储存的签名
    signatures = {},

    PORT = 80;


// Settings
// ---------------------------

app.disable('x-powered-by');
app.set('port', PORT);
// app.use(express.static(__dirname + '/build'));


// 微信对话服务
// ---------------------------

app.use(express.query());

app.use('/weixin-access', wechat(config, function (req, res, next) {

  // 微信输入信息都在req.weixin上
  var message = req.weixin;

  console.log(req.weixin);

  switch (message.MsgType) {
  case 'text':
    res.reply({
      content: '一位圣贤曾经说过: ' + message.Content,
      type   : 'text'
    });
    break;
  case 'image':
    res.reply({
      content: {
        mediaId: message.MediaId
      },
      type   : 'image'
    });
    break;
  case 'voice':
    res.reply({
      content: '一位圣贤曾经说过: ' + message.Recognition,
      type   : 'text'
    });
    break;
  case 'video':
    res.reply({
      content: '奇怪的视频',
      type   : 'text'
    });
    break;
  case 'shortvideo':
    res.reply({
      content: '奇怪的小视频',
      type   : 'text'
    });
    break;
  case 'location':
    res.reply({
      content: '听说你在: ' + message.Label,
      type   : 'text'
    });
    break;
  }
}));


// Middleware
// ---------------------------

app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());


// 微信网页服务
// ---------------------------

app.get('', function (req, res) {
  var url;

  if (req.url === '/') {
    url = 'http://whaleplayer.com/';
  } else {
    url = 'http://whaleplayer.com' + req.url;
  }

  if (!signatures[url] || Date.now() - signatures[url].timestamp > 7200 * 1000) {
    getAccessToken(url, function () {
      res.sendFile(__dirname + '/build/index.html');
    });
  } else {
    res.sendFile(__dirname + '/build/index.html');
  }
});


// 网页动态获取 signature
app.get('/weixin-config', function (req, res) {
  var url = req.headers.referer;

  res.send({
    appId    : APP_ID,
    timestamp: signatures[url].timestamp,
    nonceStr : NONCE_STR,
    signature: signatures[url].signature
  });
});


// 验证消息真实性（接受微信后台发来的初始验证）
app.get('/weixin-access', function (req, res) {
  var signature = req.query.signature,
      timestamp = req.query.timestamp,
      nonce = req.query.nonce,
      echostr = req.query.echostr,
      result = crypto.createHash('sha1').update([TOKEN, timestamp, nonce].sort().join('')).digest('hex');

  if (signature === result) {
    res.send(echostr);
  } else {
    res.sendStatus(401);
  }
});


// 获取 JS-SDK 使用权限
// ---------------------------

function getAccessToken(url, cb) {
  var req = https.request({
    method: 'GET',
    host  : 'api.weixin.qq.com',
    path  : '/cgi-bin/token?grant_type=client_credential' +
    '&appid=' + APP_ID +
    '&secret=' + APP_SECRET
  }, function (res) {
    var body = '';

    res.on('data', function (data) {
      body += data;
    }).on('end', function () {
      getJsapiTicket(url, JSON.parse(body)['access_token'], cb);
    });
  });

  req.end();
}

function getJsapiTicket(url, ACCESS_TOKEN, cb) {
  var req = https.request({
    method: 'GET',
    host  : 'api.weixin.qq.com',
    path  : '/cgi-bin/ticket/getticket?' +
    'access_token=' + ACCESS_TOKEN + '&type=jsapi'
  }, function (res) {
    var body = '';

    res.on('data', function (data) {
      body += data;
    }).on('end', function () {
      var result, prop,
          timestamp = Date.now(),
          strs = [];

      result = {
        jsapi_ticket: JSON.parse(body)['ticket'],
        noncestr    : NONCE_STR,
        timestamp   : timestamp,
        url         : url
      };

      for (prop in result) if (result.hasOwnProperty(prop)) {
        strs.push(prop + '=' + result[prop]);
      }

      signatures[url] = {
        signature: crypto.createHash('sha1').update(strs.join('&')).digest('hex'),
        timestamp: timestamp
      };

      if (cb) cb();
    });
  });

  req.end();
}


// Listening
// ---------------------------

app.listen(app.get('port'), function () {
  console.log('Listening at port: ' + app.get('port'));
});