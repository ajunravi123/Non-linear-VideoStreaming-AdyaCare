var modal = document.getElementById('loginModal');
const videoElement = document.getElementById('playing_video');
var user_name = "";

//Note: default settings should be fetched from server. Also, use localstorage to store token or any other settings.
var active_id = 1
var last_watched_video_id = 1
var last_end_time = 0
var default_video_id = 1

// Simple login modal for identifying user
function login() {
    let uname = document.getElementById('user_name').value;
    if(uname != ""){
        user_name = uname
        fetch("http://localhost:3000/user_info", {
            headers: {
                token: `${user_name}`
            }
        })
        .then(response => {
            if (!response.ok) {
            throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(function (data) {
            modal.style.display = 'none';
            document.getElementById("playing_video").style.display = 'block';
            load_videos()
            last_watched_video_id = data.last_watched_video_id
            last_end_time = data.start_from
        })
        .catch(error => {
            alert(error)
            console.error('Error:', error);
        });
    }
}

// Function for loading video based on it's id
function load_video(id, start_from = 0){
    active_id = id;
    videoElement.src = `http://localhost:3000/video?token=${user_name}&id=${id}`;
    reset_selection()
    document.getElementById("box"+id).style.borderColor = 'red';
    if(start_from > 0){
        setTimeout(function(){
            videoElement.currentTime = start_from;
        }, 1000);
    }else{
        fetch("http://localhost:3000/get_last_loc", {
            headers: {
                user_name: `${user_name}`,
                video_id: id
            }
        })
        .then(response => {
            if (!response.ok) {
            throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log(data)
            videoElement.currentTime = data.start_from;
        })
        .catch(error => {
            alert(error)
            console.error('Error:', error);
        });
    }
}

// Resetting the video tiles css
function reset_selection(){
    let elements = document.getElementsByClassName('box');
    for (let i = 0; i < elements.length; i++) {
        elements[i].style.borderColor = '#666';
    }
}

// loading video details from server to list on the UI
function load_videos(){
    fetch("http://localhost:3000/videos", {
        headers: {
            token: `${user_name}`
        }
    })
    .then(response => {
        if (!response.ok) {
        throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        let is_deleted = true;
        for(i in data) {
            if(data[i]["id"] == last_watched_video_id){
                is_deleted = false;
            }
            let html = `
                <div class="box" id="box${data[i]["id"]}" onclick="load_video(${data[i]["id"]})">
                    <img class="thumbnail" src="http://localhost:3000/${data[i]["thumbnail"]}">
                    <div class="v_title">${data[i]["title"]}</div>
                </div>`
            document.getElementById("all_videos").innerHTML += html
        }
        if(is_deleted){
            last_watched_video_id = default_video_id
            last_end_time = 0
        }
        load_video(last_watched_video_id, last_end_time)
    })
    .catch(error => {
        alert(error)
        console.error('Error:', error);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    modal.style.display = 'block';
});

const socket = new WebSocket('ws://localhost:3001');
socket.addEventListener('open', () => {
    console.log('WebSocket connection opened');
    setInterval(function () {
        let jsonData = { 
            video_id: active_id,
            current_time: videoElement.currentTime,
            user_name: user_name
        };
        let jsonString = JSON.stringify(jsonData);
        socket.send(jsonString);
    }, 2000);
});

socket.addEventListener('message', (event) => {
    console.log('Received message from server:', event.data);
});

socket.addEventListener('close', () => {
    console.log('WebSocket connection closed');
});