import { useState, useRef, useCallback, useEffect } from 'react';

const CommradCamera = () => {

    const [active, setActive] = useState(false);
    const [deviceId, setDeviceId] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [devices, setDevices] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(null);
    const [durations, setDurations] = useState([]);

    const videoRef = useRef();
    const startTimeRef = useRef();
    const recorderRef = useRef();
    const streamRef = useRef();
    const dialogRef = useRef();

    const activate = async () => {
        // Request permission to use the camera
        const permission = await navigator.permissions.query({ name: "camera" });
        if (permission.state === "granted") {
            const [devices, deviceId] = await getDevices();
            setActive(true);
        }
    }

    useEffect(() => {
        activate();
    }, [])

    useEffect(() => {
        if (!videoRef.current || !isPlaying) {
            return;
        }
        videoRef.current.addEventListener('ended', handleEnded);
        return () => {
            videoRef.current.removeEventListener('ended', handleEnded);
        }
    }, [isPlaying, videoRef]);

    useEffect(() => {
        if (streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [streamRef]);

    useEffect(() => {
        if (deviceId) {
            setupStream(deviceId);
        }
    }, [deviceId])

    const setupStream = async (deviceId) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId } });
            streamRef.current = stream;
        } catch (error) {
            console.error('Error getting video stream', error, devices, deviceId);
        }
    }

    const getDevices = async () => {
        const enumeratedDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = enumeratedDevices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        setDeviceId(videoDevices[0].deviceId);
        return [videoDevices, videoDevices[0].deviceId];
    }

    const handleDataAvailable =(e) => {
        setRecordings(prevRecordings => [...prevRecordings, e.data]);
    }

    const handleStart = () => {
        setIsRecording(true);
        startTimeRef.current = Date.now();
    }

    const handleEnded = () => {
        setIsPlaying(null);
    }

    const handleStop = () => {
        setIsRecording(false);
        setDurations(prevDurations => [...prevDurations, Date.now() - startTimeRef.current]);
        destroyRecorder();
    }

    const start = async () => {
        await setupRecorder();
        recorderRef.current.start();
    }

    const stop = () => {
        if (isRecording) {
            recorderRef.current.stop();
        }
    }

    const setupRecorder = async () => {
        if (!streamRef.current) {
            return;
        }
        // Get the video stream using the default device
        const stream = streamRef.current;
        const recorder = new MediaRecorder(stream);
        recorder.onstart = () => handleStart();
        recorder.onstop = () => handleStop();
        recorder.ondataavailable = (e) => handleDataAvailable(e);
        recorderRef.current = recorder;
    }

    const destroyRecorder = () => {
        recorderRef.current.stream.getTracks().forEach(track => track.stop());
        recorderRef.current = null;
    }

    const deactivate = () => {
        setActive(false);
    }

    const leadingZero = (number) => {
        return number < 10 ? `0${number}` : number;
    }

    const readableDuration = (duration) => {
        const milliseconds = duration % 1000;
        const seconds = Math.floor((duration / 1000) % 60);
        const minutes = Math.floor((duration / (1000 * 60)) % 60);
        const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
        return `${leadingZero(hours)}:${leadingZero(minutes)}:${leadingZero(seconds)}.${leadingZero(milliseconds)}`;
    }

    const play = (index) => {
        const video = videoRef.current;
        video.src = URL.createObjectURL(recordings[index]);
        video.play();
        setIsPlaying(index);
    }

    const pause = (index) => {
        videoRef.current.pause();
        setIsPlaying(null);
    }

    const remove = (index) => {
        setRecordings(prevRecordings => prevRecordings.filter((_, i) => i !== index));
        setDurations(prevDurations => prevDurations.filter((_, i) => i !== index));
    }

    return (
        <div>
            <video ref={videoRef} autoplay={true} muted={true}></video>
            <dialog ref={dialogRef} onClick={(e) => {
                if (e.target === dialogRef.current) dialogRef.current.close();
            }}>
                <select onChange={(e) => setDeviceId(e.target.value)}>
                    {devices.map(device => <option value={device.deviceId}>{device.label}</option>)}
                </select>
                <button onClick={() => dialogRef.current.close()}>Close</button>
            </dialog>
            <ul>
                {recordings.map((recording, index) => {
                    const duration = readableDuration(durations[index]);
                    return <li>
                        Recording {index + 1} - {duration}
                        {isPlaying === index ? (
                            <button onClick={() => pause(index)}>Pause</button>
                        ) : (
                            <button onClick={() => play(index)}>Play</button>
                        )}
                        <button onClick={() => remove(index)}>Remove</button>
                    </li>
                })}
            </ul>
            {active ? (
                <div>
                    {isRecording ? (
                        <button onClick={() => stop()}>Stop</button>
                    ) : (
                        <button onClick={() => start()}>Record</button>
                    )}
                    <button onClick={() => dialogRef.current.showModal()}>Settings</button>
                </div>
            ) : (
                <button onClick={() => activate()}>Activate</button>
            )}
        </div>
    )
}

export default CommradCamera;