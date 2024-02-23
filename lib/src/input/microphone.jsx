import { useRef, useState, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js'
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js'
import { FaCircle, FaStop, FaPlay, FaPause, FaTrash } from "react-icons/fa";


const CommradMicrophone = () => {

    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(null);
    const [loadedRecording, setLoadedRecording] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    
    const waveformRef = useRef();
    const wavesurferRef = useRef();
    const recordRef = useRef(); 
    const dialogRef = useRef();

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
            const audioDevices = devices.filter((device) => device.kind === 'audioinput');
            setDevices(audioDevices);
            setSelectedDevice(audioDevices[0].deviceId);
        });
        const wavesurfer = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: 'rgb(200, 0, 200)',
            progressColor: 'rgb(100, 0, 100)',
            barWidth: 6,
            barGap: 4,
            barRadius: 20,
        })
        wavesurfer.on('finish', () => {
            setIsPlaying(null);
        });
        const record = wavesurfer.registerPlugin(RecordPlugin.create({ scrollingWaveform: true, renderRecordedAudio: false }));
        record.on('record-end', (blob) => {
            setRecordings((prev) => [...prev, blob]);
        });
        wavesurferRef.current = wavesurfer;
        recordRef.current = record;
    }, []);

    const startRecording = () => {
        recordRef.current.startRecording({ selectedDevice }).then(() => {
            setIsRecording(true);
        })
    }

    const stopRecording = () => {
        recordRef.current.stopRecording();
        setIsRecording(false);
    }

    const loadRecording = (index) => {
        wavesurferRef.current.loadBlob(recordings[index]);
        wavesurferRef.current.once('ready', () => {
            wavesurferRef.current.seekTo(0);
            setLoadedRecording(index);
        })
    }

    const playPauseRecording = (index) => {
        if (loadedRecording === index) {
            if (wavesurferRef.current.isPlaying()) {
                setIsPlaying(null);
            } else {
                setIsPlaying(index);
            }
            wavesurferRef.current.playPause();
        } else {
            wavesurferRef.current.loadBlob(recordings[index]);
            wavesurferRef.current.once('ready', () => {
                wavesurferRef.current.play();
                setLoadedRecording(index);
                setIsPlaying(index);
            })
        }
    }

    return (
        <>
        <style>
            {`
                .input {
                    width: 400px;
                }
                .waveform {
                    background: lightgray;
                    margin-bottom: 0.5rem;
                }
                .recordings {
                    list-style: none;
                    display: flex;
                    flex-direction: column;
                    padding: 0;
                    gap: 6px;
                    margin: 0;
                    min-height: 60px;
                }
                .recordings li {
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 0.5rem;
                }
                .empty {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 60px;
                }
                .controls {
                    display: flex;
                    margin-top: 1rem;
                    justify-content: center;
                }

                .pauseplay {
                    margin-right: 0.5rem;
                }
            `}
        </style>
        <div className="input">
            <dialog ref={dialogRef}>
                <h2>Choose a microphone</h2>
                <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
                    {devices.map((device, index) => (
                        <option key={index} value={device.deviceId}>{device.label}</option>
                    ))}
                </select>
            </dialog>
            <div className="waveform" ref={waveformRef}></div>
            {recordings.length > 0 ? (
                <ul className="recordings">
                    {recordings.map((recording, index) => (
                        <li onClick={(e) => {
                            if (e.target.tagName === 'BUTTON') return;
                            wavesurferRef.current.loadBlob(recording);
                            wavesurferRef.current.once('ready', () => {
                                setLoadedRecording(index);
                            })
                        }}>
                            <span style={{display: 'flex', alignItems: 'center'}}>
                                <button className="pauseplay" onClick={() => playPauseRecording(index)}>{isPlaying === index ? <FaPause/> : <FaPlay/>}</button>
                                Recording {index + 1}
                            </span>
                            <button onClick={() => {
                                setRecordings((prev) => prev.filter((_, i) => i !== index));
                                if (loadedRecording === index) {
                                    wavesurferRef.current.empty();
                                    setLoadedRecording(null);
                                }
                            }}><FaTrash/></button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="empty">No recordings</div>
            )}
            <div className="controls">
                {isRecording ? <button onClick={() => stopRecording()}><FaStop/></button> : <button onClick={() => startRecording()}><FaCircle/></button>}
            </div>
        </div>
        </>
    )
}

export default CommradMicrophone;