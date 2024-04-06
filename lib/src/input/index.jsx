import CommradMicrophone from "./microphone";
import CommradCamera from "./camera";

import { useEffect, useState, useRef } from 'react';

const CommradInput = ({ type = 'World', node}) => {
    
    const [media, setMedia] = useState([]);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!inputRef.current) {
            inputRef.current = document.createElement('input');
            inputRef.current.type = 'file';
            inputRef.current.style.display = 'none';
            inputRef.current.name = node.hasAttribute('name') ? node.getAttribute('name') : type;
        }
        if (node) {
            const form = node.closest('form');
            if (form) {
                form.appendChild(inputRef.current);
            }
        }
        return () => {
            if (node) {
                const form = node.closest('form');
                if (form) {
                    form.removeChild(inputRef.current);
                }
            }
        }
    }, [])

    const handleMediaChange = async () => {
        const dataTransfer = new DataTransfer();
        for (const m of media) {
            let blob = await fetch(m).then(r => r.blob());
            // Get file type from blob type
            const file = new File([blob], 'test', { type: blob.type });
            dataTransfer.items.add(file);
        }

        const fileList = dataTransfer.files;

        inputRef.current.files = fileList;
    
    }

    useEffect(() => {
        handleMediaChange();
    }, [media]);

    switch (type) {
        case 'microphone':
            return <CommradMicrophone onChange={(val) => setMedia(val)} />;
        case 'camera':
            return <CommradCamera onChange={(val) => setMedia(val)} />;
        default:
            return <div>Input type not supported: {type}</div>;
    }
}

export default CommradInput;