import { useState, useRef, useCallback, useEffect } from 'react';

const CommradMicrophone = () => {

    const [active, setActive] = useState(false);
    const [deviceId, setDeviceId] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [devices, setDevices] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(null);
    const [durations, setDurations] = useState([]);

    const audioRef = useRef();
    const startTimeRef = useRef();
    const recorderRef = useRef();
    const dialogRef = useRef();

    useEffect(() => {
        navigator.permissions.query({ name: "microphone" }).then(async(res) => {
            if(res.state == "granted"){
                await getDevices();
                setActive(true);
            }
        });
        audioRef.current.addEventListener('ended', handleEnded);
        return () => {
            audioRef.current.removeEventListener('ended', handleEnded);
        }
    }, [recordings]);

    const getDevices = async () => {
        const enumeratedDevices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = enumeratedDevices.filter(device => device.kind === 'audioinput');
        setDevices(audioDevices);
        setDeviceId(audioDevices[0].deviceId);
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
        // Get the audio stream using the default device
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId } });
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

    const activate = async () => {
        await getDevices();
        setActive(true);
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
        const audio = audioRef.current;
        audio.src = URL.createObjectURL(recordings[index]);
        audio.play();
        setIsPlaying(index);
    }

    const pause = (index) => {
        audioRef.current.pause();
        setIsPlaying(null);
    }

    const remove = (index) => {
        setRecordings(prevRecordings => prevRecordings.filter((_, i) => i !== index));
        setDurations(prevDurations => prevDurations.filter((_, i) => i !== index));
    }

    return (
        <div>
            <audio ref={audioRef}></audio>
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

export default CommradMicrophone;