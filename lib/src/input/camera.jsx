import { useRef, useState, useEffect } from 'react';
import { FaCircle, FaStop, FaCamera, FaVideo } from "react-icons/fa";

const CommradCamera = () => {

    const previewRef = useRef();
    const imageRef = useRef();
    const videoRef = useRef();
    const [mediaStream, setMediaStream] = useState(null);
    const mediaRecorderRef = useRef();
    const chunksRef = useRef([]);
    const dialogRef = useRef();

    const [mode, setMode] = useState('video');

    const [isRecording, setIsRecording] = useState(false);
    const [capturedMediaArr, setCapturedMediaArr] = useState([]);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState(null);

    useEffect(() => {
        if (selectedMedia) {
            if (selectedMedia.includes('image')) {
                imageRef.current.src = selectedMedia;
            } else {
                videoRef.current.src = selectedMedia;
                videoRef.current.play();
            }
        }
    }, [selectedMedia])

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
            const videoDevices = devices.filter((device) => device.kind === 'videoinput');
            setDevices(videoDevices);
            setSelectedDevice(videoDevices[0].deviceId);
        });
    }, []);

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: selectedDevice
            }
        }).then((stream) => {
            setMediaStream(stream);
        })
    }, [selectedDevice]);

    useEffect(() => {

        if (selectedMedia) return;
        if (!mediaStream) return;
        if (!previewRef.current) return;

        previewRef.current.srcObject = mediaStream;

    }, [mediaStream, previewRef, selectedMedia])

    const startRecording = () => {
        mediaRecorderRef.current = new MediaRecorder(mediaStream, { mimeType: 'video/webm' });
        mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            setCapturedMediaArr((prev) => [...prev, url]);
            chunksRef.current = [];
        };
        mediaRecorderRef.current.start();
        setIsRecording(true);
    }

    const stopRecording = () => {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }

    const takePhoto = () => {
        const canvas = document.createElement('canvas');
        canvas.width = previewRef.current.videoWidth;
        canvas.height = previewRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(previewRef.current, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL('image/png');
        setCapturedMediaArr((prev) => [...prev, url]);
    }

    return (
        <>
        <style>
            {`
                .input {
                    width: 600px;
                }
                .controls {
                    display: flex;
                    justify-content: space-between;
                }

                .modes {
                    display: flex;
                    align-items: center;
                }

                .modes button:not(.active) {
                    opacity: 0.5;
                }
                .roll{
                    display: flex;
                    list-style: none;
                    padding: 0;
                    align-items: center;
                    justify-content: flex-end;
                    overflow-x: auto;
                    gap: 6px;
                    margin: 0;
                }
                .roll img, .roll video {
                    aspect-ratio: 1/1;
                    height: 60px;
                    object-fit: cover;
                    cursor: pointer;
                    margin-bottom: 1rem;
                }
                .media {
                    aspect-ratio: 1/1;
                    background: black;
                    margin-bottom: 1rem;
                }

                .media img, .media video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
            `}
        </style>
        <div className="input">
            <dialog ref={dialogRef} onClick={(e) => {
                if (e.target === dialogRef.current) {
                    dialogRef.current.close();
                }
            }}>
                <span>Settings</span><br/>
                <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
                    {devices.map((device, index) => (
                        <option key={index} value={device.deviceId}>{device.label}</option>
                    ))}
                </select>
            </dialog>
            <div className="media">
            {selectedMedia ? (
                <>
                    {selectedMedia.includes('image') && <img ref={imageRef} />}
                    {!selectedMedia.includes('image') && <video ref={videoRef} />}
                </>
            ) : (
                <video ref={previewRef} autoPlay playsInline muted></video>
            )}
            </div>
            <ul className="roll">
                {capturedMediaArr.map((media, index) => (
                    <li key={index} onClick={() => {
                        setSelectedMedia(media);
                    }}>
                        {media.includes('image') ? (
                            <img src={media}/>
                        ) : (
                            <video src={media}/>
                        )}
                    </li>
                ))}
            </ul>
            <div className="controls">
                <div className="modes">
                    <button onClick={() => {
                        setMode('video');
                        setSelectedMedia(null);
                    }} className={mode === 'video' ? 'active' : ''}><FaVideo/></button>
                    <button onClick={() => {
                        setMode('image');
                        setSelectedMedia(null);
                    }} className={mode === 'image' ? 'active' : ''}><FaCamera/></button>
                </div>
                {selectedMedia ? (
                    <button onClick={() => setSelectedMedia(null)} style={{opacity: 0.5}}>
                        <FaCircle/>
                    </button>
                ) : (
                    <>
                        {mode === 'video' ? (
                            <>
                                {isRecording ? (
                                    <button onClick={() => stopRecording()}><FaStop/></button>
                                ) : (
                                    <button onClick={() => startRecording()}><FaCircle/></button>
                                )}
                            </>
                        ) : (
                            <button onClick={() => takePhoto()}><FaCamera/></button>
                        )}
                    </>
                )}
                <button onClick={() => dialogRef.current.showModal()}>Settings</button>
            </div>
        </div>
        </>
    )
}

export default CommradCamera;