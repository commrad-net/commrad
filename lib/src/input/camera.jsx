import { useRef, useState, useEffect } from 'react';
import { FaCircle, FaStop, FaCamera, FaVideo } from "react-icons/fa";
import { FaCircleXmark, FaGear } from "react-icons/fa6";

const CommradCamera = ({onChange}) => {

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
       if (onChange) onChange(capturedMediaArr);
    }, [capturedMediaArr]);

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
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }

                .modes {
                    display: flex;
                    align-items: center;
                    position: absolute;
                    left: 0;
                }

                .settings {
                    position: absolute;
                    right: 0;
                }

                .modes button.active {
                    background: black;
                    color: white;
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
                    height: 6rem;
                }
                .roll img, .roll video {
                    aspect-ratio: 1/1;
                    height: 4rem;
                    object-fit: cover;
                    cursor: pointer;
                    border-radius: 6px;
                }
                .media {
                    aspect-ratio: 1/1;
                    background: black;
                    border-radius: 6px;
                    overflow: hidden;
                }

                .media img, .media video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .roll li {
                    position: relative;
                }

                li img {
                    border: 2px solid transparent;
                }

                .selected img, .selected video {
                    border: 2px solid black;
                }

                .remove {
                    position: absolute;
                    top: -0.5rem;
                    left: -0.5rem;
                    background: white;
                    border-radius: 50%;
                    font-size: 1rem;
                }

                button {
                    background: white;
                    color: black;
                    border: 2px solid black;
                    aspect-ratio: 1/1;
                    font-size: 1.2rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 2.5rem;
                    border-radius: 6px;
                }

                .modes button {
                    aspect-ratio: 1.25/1;
                }

                .modes button:first-child {
                    border-radius: 0px;
                    border-top-left-radius: 6px;
                    border-bottom-left-radius: 6px;
                }

                .modes button:last-child {
                    border-radius: 0px;
                    border-top-right-radius: 6px;
                    border-bottom-right-radius: 6px;
                }

                .capture {
                    font-size: 1.3rem;
                    background: red;
                    border-radius: 50%;
                    color: white;
                    height: 3rem;
                    border: 2px solid red;
                }

                .capture.inverse {
                    background: white;
                    color: red;
                    border: 2px solid red;
                }

                .empty {
                    height: 6rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
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
            {capturedMediaArr.length === 0 && <div className="empty">No media captured</div>}
            {capturedMediaArr.length > 0 && (
                <ul className="roll">
                    {capturedMediaArr.map((media, index) => (
                        <li className={selectedMedia === media ? "selected" : null} key={index} onClick={() => {
                            setSelectedMedia(media);
                        }}>
                            {selectedMedia === media && <div class="remove" onClick={ () => {
                                setCapturedMediaArr(capturedMediaArr.filter((m) => m !== media));
                                setSelectedMedia(null);
                            }}>
                                <FaCircleXmark/>
                            </div>}
                            {media.includes('image') ? (
                                <img src={media}/>
                            ) : (
                                <video src={media}/>
                            )}
                        </li>
                    ))}
                </ul>
            )}
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
                    <button onClick={() => setSelectedMedia(null)} className="capture inverse">
                        {mode === 'video' ? <FaVideo/> : <FaCamera/>}
                    </button>
                ) : (
                    <>
                        {mode === 'video' ? (
                            <>
                                {isRecording ? (
                                    <button onClick={() => stopRecording()} className="capture inverse"><FaStop/></button>
                                ) : (
                                    <button onClick={() => startRecording()} className="capture"><FaVideo/></button>
                                )}
                            </>
                        ) : (
                            <button onClick={() => takePhoto()} className="capture"><FaCamera/></button>
                        )}
                    </>
                )}
                <button className="settings" onClick={() => dialogRef.current.showModal()}><FaGear/></button>
            </div>
        </div>
        </>
    )
}

export default CommradCamera;