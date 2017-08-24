'use strict';

const electron = require('electron');
const remote = electron.remote;
const dialog = remote.dialog;
const fs = require('fs');
const shell = electron.shell;

let width = 320; // We will scale the photo width to this
let height = 0;  // This will be computed based on the input stream
let streaming = false;
let data = null; // Photo img src
const extension = 'png'; // Extensions of image file

let devicesList = new Array(); // array of devices
let deviceIndex = 0; // index of current using devices 


function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  let videoSelect = document.querySelector('select#videoSource');
  const selectors = [videoSelect];

  const values = selectors.map(function(select) {
    return select.value;
  });
  selectors.forEach(function(select) {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (var i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    let option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || 'camera ' + (videoSelect.length + 1);
      videoSelect.appendChild(option);
    }
  }
  selectors.forEach(function(select, selectorIndex) {
    if (Array.prototype.slice.call(select.childNodes).some(function(n) {
      return n.value === values[selectorIndex];
    })) {
      select.value = values[selectorIndex];
    }
  });
}

function getDevicesList(deviceInfos) {
  if (deviceInfos != null && deviceInfos.length > 0 ) {
    devicesList = [];
    for (var i = 0; i !== deviceInfos.length; ++i) {
      const deviceInfo = deviceInfos[i];
      let option = document.createElement('option');
      option.value = deviceInfo.deviceId;
      if (deviceInfo.kind === 'videoinput') {
        const text = deviceInfo.label || 'camera ' + (videoSelect.length + 1);
        devicesList.push({ videoID: deviceInfo.deviceId, label: text} );
      }
    }
    return devicesList;
  }
}

function gotStream(stream) {
  let videoElement = document.querySelector('video');
  window.stream = stream; // make stream available to console

  if (URL) {
    videoElement.src = URL.createObjectURL(stream);
  } else {
    videoElement.srcObject = stream;
  }  
  // Refresh button list in case labels have become available
  return navigator.mediaDevices.enumerateDevices();
}

function start(e) {
  const videoSelect = document.querySelector('select#videoSource');
  if (window.stream) {
    window.stream.getTracks().forEach(function(track) {
      if (''.concat(e.currentTarget.id).startsWith(track.kind)) {
        track.stop();
      }
    });
  }
  const videoSource = videoSelect.value;
  const constraints = {
    audio: false,
    video: {deviceId: videoSource ? {exact: videoSource} : undefined}
  };
  navigator.mediaDevices.getUserMedia(constraints).
      then(gotStream).then(gotDevices).catch(handleError);
}

function handleError(error) {
  console.log('navigator.getUserMedia error: ', error);
}

function clearphoto() {
  const downloadbutton = document.getElementById('downloadbutton');
  let context = canvas.getContext('2d');
  context.fillStyle = "#EEE";
  context.fillRect(0, 0, canvas.width, canvas.height);

  downloadbutton.style.visibility = 'hidden';

  const data = canvas.toDataURL('image/png');
  photo.setAttribute('src', data);
}

// Capture a photo by fetching the current contents of the video
// and drawing it into a canvas, then converting that to a PNG
// format data URL. By drawing it on an offscreen canvas and then
// drawing that to the screen, we can change its size and/or apply
// other changes before drawing it.
function takepicture() {
  const context = canvas.getContext('2d');
  if (width && height) {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);
  
    data = canvas.toDataURL('image/png');
    if(data != null) {
      photo.setAttribute('src', data);
      downloadbutton.style.visibility = 'visible';
    }
  } else {
    clearphoto();
  }
}

function switchCam(e) {
  navigator.mediaDevices.enumerateDevices().then(getDevicesList).catch(handleError);
  if (devicesList.length > 0) {
    if (deviceIndex >= devicesList.length) {
      deviceIndex = devicesList.length - 1;
    }
    if (deviceIndex < devicesList.length - 1) {
      deviceIndex++;
    } else {
      deviceIndex = 0; // default device is 0 (zero)
    }
    let curDevice = devicesList[deviceIndex];

    let videoSource = null;
    if (curDevice !=null && curDevice.hasOwnProperty('videoID')) {
      videoSource = curDevice.videoID;
      console.log('Camera was switched to device: ' + curDevice.label);
    }
    const constraints = {
      audio: false,
      video: {deviceId: videoSource ? {exact: videoSource} : undefined}
    };
    navigator.mediaDevices.getUserMedia(constraints).then(gotStream);
  }
}

function savePhotoAsFile() {
  const contentType = 'image/png';
 
  dialog.showSaveDialog({filters: [
    {name: 'Images', extensions: ['jpg', 'png', 'gif']}]}, (fileName) => {
    if (fileName === undefined) {
      console.log("You didn't save the file");
      return;
    }

    // fileName is a string that contains the path and filename created in the save file dialog.  
    fs.writeFile(fileName, data, (err) => {
      if(err) {
          alert("An error ocurred creating the file "+ err.message)
      }

      alert("The file has been succesfully saved");
    });
  }); 
}

function startApp() {
  const videoSelect = document.querySelector('select#videoSource');
  const selectors = [videoSelect];
  const startbutton = document.getElementById('startbutton');
  const clearbutton = document.getElementById('clearbutton');
  const camerabutton = document.getElementById('camerabutton');
  const downloadbutton = document.getElementById('downloadbutton');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');

  navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);
  navigator.mediaDevices.enumerateDevices().then(getDevicesList).catch(handleError);

  camerabutton.onclick = switchCam;
  videoSelect.onchange = start;

  video.addEventListener('canplay', function(ev) {
    if (!streaming) {
      height = video.videoHeight / (video.videoWidth/width);

      // Firefox currently has a bug where the height can't be read from
      // the video, so we will make assumptions if this happens.
      if (isNaN(height)) {
        height = width / (4/3);
      }

      video.setAttribute('width',   width);
      video.setAttribute('height',  height);
      canvas.setAttribute('width',  width);
      canvas.setAttribute('height', height);
      streaming = true;
    }
  }, false);

  startbutton.addEventListener('click', function(e) {
    takepicture();
    e.preventDefault();
  }, false);

  clearbutton.addEventListener('click', function(e) {
    clearphoto();
    e.preventDefault();
  }, false);

  clearphoto();
  downloadbutton.onclick = savePhotoAsFile;

  $(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href);
  });

  start();
}
