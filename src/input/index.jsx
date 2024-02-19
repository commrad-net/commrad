import CommradMicrophone from "./microphone";
import CommradCamera from "./camera";

const CommradInput = ({ type = 'World' }) => {
    switch (type) {
        case 'microphone':
            return <CommradMicrophone />;
        case 'camera':
            return <CommradCamera />;
        default:
            return <div>Input type not supported: {type}</div>;
    }
}

export default CommradInput;