import Alpine from 'alpinejs'
import PocketBase from 'pocketbase'

const scriptTag = document.currentScript;
const scriptTagData = scriptTag.dataset;

const prefix = scriptTagData.prefix || 'cr';
const db = new PocketBase();

const init = () => {

    // Set the prefix for AlpineJS
    Alpine.prefix(`${prefix}-`);

    Alpine.magic('db', (el, { Alpine }) => {
        return db;
    });

    Alpine.magic('getOne', (el, { Alpine }) => (collectionIdOrName, recordId, options = {}) => {
        return db.collection(collectionIdOrName).getOne(recordId, options);
    })

    Alpine.magic('getList', (el, { Alpine }) => (collectionIdOrName, page = '1', perPage = '50', options = {}) => {
        return db.collection(collectionIdOrName).getList(page, perPage, options);
    })

    Alpine.magic('getFullList', (el, { Alpine }) => (collectionIdOrName, options = {}) => {
        return db.collection(collectionIdOrName).getFullList(options);
    })

    Alpine.magic('getFirstListItem', (el, { Alpine }) => (collectionIdOrName, filter, options = {}) => {
        return db.collection(collectionIdOrName).getFirstListItem(filter, options);
    })

    Alpine.magic('get', (el, { Alpine }) => (collectionIdOrName, arg1 = null, arg2 = null, arg3 = null) => {
        switch (true) {
            case (
                (typeof arg1 === 'string' && arg1.length === 15) &&
                (typeof arg2 === 'object' || arg2 === null) &&
                arg3 === null
            ): {
                return db.collection(collectionIdOrName).getOne(arg1, arg2 ?? {});
            }
            case (
                typeof arg1 === 'string' &&
                typeof arg2 === 'string' &&
                (typeof arg3 === 'object' || arg3 === null)
            ): {
                return db.collection(collectionIdOrName).getList(arg1, arg2, arg3 ?? {});
            }
            case (
                (typeof arg1 === 'object' || arg1 === null) &&
                arg2 === null &&
                arg3 === null
            ): {
                return db.collection(collectionIdOrName).getFullList(arg1 ?? {});
            }
            case (
                typeof arg1 === 'string' &&
                (typeof arg2 === 'object' || arg2 === null) &&
                arg3 === null
            ): {
                return db.collection(collectionIdOrName).getFirstListItem(arg1, arg2 ?? {});
            }
            default: {
                return [];
            }
        }
    })

    Alpine.magic('create', (el, { Alpine }) => (collectionIdOrName, bodyParams, options) => {
        return db.collection(collectionIdOrName).create(bodyParams, options);
    })

    Alpine.magic('update', (el, { Alpine }) => (collectionIdOrName, recordId, bodyParams, options) => {
        return db.collection(collectionIdOrName).update(recordId, bodyParams, options);
    })

    Alpine.magic('delete', (el, { Alpine }) => (collectionIdOrName, recordId, options) => {
        return db.collection(collectionIdOrName).delete(recordId, options);
    })

    Alpine.magic('login', (el, { Alpine }) => (usernameOrEmail, password, collection = 'users') => {
        return db.collection(collection).authWithPassword(usernameOrEmail, password);
    })

    Alpine.magic('oauth2', (el, { Alpine }) => (provider, collection = 'users') => {
        return db.collection(collection).authWithOAuth2({ provider });
    })

    Alpine.magic('logout', () => {
        db.authStore.clear();
    })
        
    Alpine.start();

    const commands = {
        db: () => {
            // Get screen width and height
            const width = window.screen.width;
            const height = window.screen.height;

            // Open a new window without any menu items, set to 80% window width and height, to the admin page
            window.open('/_/', '_blank', `width=${width * 0.8},height=${height * 0.8},menubar=no,location=no,resizable=yes,scrollbars=yes,status=no`);
            return '';
        }
    }

    for (const [key, value] of Object.entries(commands)) {
        Object.defineProperty(globalThis, key, { get: value });
    }

}
  
init();