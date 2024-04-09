import { useRef, useState, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js'
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js'
import { FaCircle, FaStop, FaPlay, FaPause, FaTrash, FaMicrophone } from "react-icons/fa";
import { FaCircleXmark } from 'react-icons/fa6';
import { PiWaveformBold } from "react-icons/pi";


const CommradMicrophone = ({onChange}) => {

    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(null);
    const [loadedRecording, setLoadedRecording] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('');

    useEffect(() => {
        const objectURLArray = recordings.map((recording) => URL.createObjectURL(recording));
        onChange(objectURLArray);
    }, [recordings]);
    
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
            waveColor: '#FFFFFF',
            progressColor: '#FF0000',
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
                    width: 600px;
                }
                .waveform {
                    background: black;
                    border-radius: 6px;
                    aspect-ratio: 16 / 9;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .waveform > div {
                    width: 100%;
                }
                .recordings {
                    display: flex;
                    list-style: none;
                    padding: 0;
                    align-items: center;
                    justify-content: flex-end;
                    overflow-x: auto;
                    gap: 10px;
                    margin: 0;
                    height: 6rem;
                }
                .recordings li {
                    aspect-ratio: 1/1;
                    height: 4rem;
                    border: transparent 2px solid;
                    background: lightgray;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    border-radius: 6px;
                    font-size: 2rem;
                }
                .recordings li.selected {
                    border: black 2px solid;
                }
                .empty {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 6rem;
                }
                .controls {
                    display: flex;
                    justify-content: center;
                }

                .pauseplay {
                    margin-right: 0.5rem;
                }

                button {
                    background: white;
                    border: 2px black solid;
                    aspect-ratio: 1 / 1;
                    font-size: 1rem;
                    border-radius: 6px;
                }

                .capture {
                    font-size: 1.3rem;
                    background: red;
                    border-radius: 50%;
                    color: white;
                    height: 3rem;
                    border: 2px solid red;
                }

                .inverse {
                    color: red;
                    background: white;
                }
                .remove {
                    position: absolute;
                    top: -0.5rem;
                    left: -0.5rem;
                    background: white;
                    border-radius: 50%;
                    font-size: 1rem;
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
            <div className="waveform"><div  ref={waveformRef}/></div>
            {recordings.length > 0 ? (
                <ul className="recordings">
                    {recordings.map((recording, index) => (
                        <li className={loadedRecording === index ? 'selected' : null} onClick={(e) => {
                            if (e.target.tagName === 'BUTTON') return;
                            wavesurferRef.current.loadBlob(recording);
                            wavesurferRef.current.once('ready', () => {
                                setLoadedRecording(index);
                                playPauseRecording(index);
                            })
                        }}>
                            {loadedRecording === index ? (
                                <div className="remove" onClick={() => {
                                setRecordings((prev) => prev.filter((_, i) => i !== index));
                                if (loadedRecording === index) {
                                    wavesurferRef.current.empty();
                                    setLoadedRecording(null);
                                }
                            }}><FaCircleXmark/></div>
                            ) : null}
                            <PiWaveformBold/>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="empty">No recordings</div>
            )}
            <div className="controls">
                {isRecording ? <button className="capture inverse" onClick={() => stopRecording()}><FaStop/></button> : <button className="capture" onClick={() => startRecording()}><FaMicrophone/></button>}
            </div>
        </div>
        </>
    )
}

export default CommradMicrophone;