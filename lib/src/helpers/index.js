export const getDataByExpression = (dataStack, expression) => {
    let dataKey;
    let data;
    if (expression && expression.includes('.')) {
        const parts = expression.split('.');
        dataKey = parts[parts.length - 2];
         // Find the specific data object that has a property matching the dataKey
        for (const value of Object.values(dataStack)) {
            if (data) {
                break;
            }
            if (Object.hasOwn(value, dataKey)) {
                data = value[dataKey];
                break;
            }
        }
    } else {
        // Find the first data object in the data stack that has an object with a property of collectionId
        for (const value of Object.values(dataStack)) {
            if (data) {
                break;
            }
            for (const subValue of Object.values(value)) {
                if (!subValue) {
                    continue;
                }
                if (Object.hasOwn(subValue, 'collectionId')) {
                    data = subValue;
                    break;
                }
            }
        }
    }
    return data;
}