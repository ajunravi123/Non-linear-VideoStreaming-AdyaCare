const express = require('express');
const fs = require('fs');
const cors = require('cors');
const WebSocket = require('ws');
const app = express();

app.use(cors());
app.use(express.static("public"))

var user_sessions = {}
var videos = {}

// Note: Use NoSql Database to store video related informations and fetch from there.
try {
  const jsonData = fs.readFileSync('videos.json', 'utf8');
  const parsedData = JSON.parse(jsonData);
  videos = parsedData;
} catch (error) {
  console.error('Error reading JSON file:', error);
}

// Define a master collection to store all tye default settings and fetch from there
function get_default(){
    return {
        last_watched_video_id : 1,
        start_from : 0
    }
}

/*
 API to fetch videos. Fetch all the available video from cache/DB with pagination.
 Following things needs to be implemented,
    1. Middleware for API Authentication (All the apis will get a token. username is used as token in the prototype)
    2. Add Pagination
    3. Rate Limiting
    4. Handle all possible exceptions
*/
app.get('/videos', (req, res) => {
    let token = req.headers.token
    if(user_sessions.hasOwnProperty(token)){
        res.setHeader('Content-Type', 'application/json');
        res.json(videos);
    }else{
        res.sendStatus(401);
        return;
    }
})

// API to fetch the meta data about the user activity
app.get('/user_info', (req, res) => {
    let token = req.headers.token
    let resp = {}
    if(user_sessions.hasOwnProperty(token)){
        resp = user_sessions[token]
    }else{
        resp = get_default()
        last_watched_video_id = resp["last_watched_video_id"]
        user_sessions[token] = {
            last_watched_video_id : 1,
            start_from : 0,
            watched_videos : {
                [last_watched_video_id] : {
                    start_from : 0
                }
            }
        }
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.json(resp);
})

// API to return the last watched location of a video
app.get('/get_last_loc', (req, res) => {
    let user_name = req.headers.user_name
    let video_id = req.headers.video_id
    let resp = {
        start_from : (!user_sessions.hasOwnProperty(user_name) || !user_sessions[user_name]["watched_videos"][video_id]) ? 0 : (user_sessions[user_name]["watched_videos"][video_id]["start_from"])
    }
    res.setHeader('Content-Type', 'application/json');
    res.json(resp);
})

// Streaming video
app.get('/video', (req, res) => {
    let token = req.query.token
    let video_id = req.query.id
    if(user_sessions.hasOwnProperty(token)){
        const range = req.headers.range;
        // For simplicity, the video url is generated automatically from the id. Change it later.
        const videoPath = `./videos/${video_id}.mp4`;
        const videoSize = fs.statSync(videoPath).size;
        const positions = range.replace(/bytes=/, '').split('-');
        const start = parseInt(positions[0], 10);
        // Setting a specific video chunksize for optimization
        let pre_size = 100000
        const end = (start + pre_size) >= (videoSize - 1) ? (videoSize - 1) : (start + pre_size);
        const contentLength = (end - start) + 1;
        const headers = {
            "Content-Range": `bytes ${start}-${end}/${videoSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": contentLength,
            "Content-Type": "video/mp4",
            "last_time" : 30
        }
        res.writeHead(206, headers);
        const stream = fs.createReadStream(videoPath, { start, end })
        stream.pipe(res);
    }else{
        res.sendStatus(401);
        return;
    }
});

app.listen('3000', () => {
    console.log('Video streaming Server is running on port 3000');
});



// Websocker server for the dynamic communication between client and server
const wss = new WebSocket.Server({ noServer: true });
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        var data = JSON.parse(message)
        if(!user_sessions[data["user_name"]]){
            return
        }

        user_sessions[data["user_name"]]["last_watched_video_id"] = data["video_id"]
        user_sessions[data["user_name"]]["start_from"] = data["current_time"]
        let vid = parseInt(data["video_id"])
        user_sessions[data["user_name"]]["watched_videos"][vid] = {
            start_from : data["current_time"]
        }
        ws.send('Server received: ' + message);
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});

const server = app.listen(3001, () => {
    console.log('Websocket Server is running on port 3001');
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});