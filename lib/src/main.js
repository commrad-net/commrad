import Alpine from 'alpinejs'
import PocketBase from 'pocketbase'
import register from 'preact-custom-element';

import CommradInput from './input';

const scriptTag = document.currentScript;
const scriptTagData = scriptTag.dataset;

const prefix = scriptTagData.prefix || 'cr';
const db = new PocketBase();

const init = () => {

    db.autoCancellation(false);

    // Set the prefix for AlpineJS
    Alpine.prefix(`${prefix}-`);

    Alpine.magic('db', (el, { Alpine }) => {
        return db;
    });

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

    const collections = document.querySelectorAll(`[${prefix}-collection]`);
    for (const collection of collections) {
        if (!collection.hasAttribute(`${prefix}-data`)) {
            collection.setAttribute(`${prefix}-data`, '');
        }
    }

    Alpine.directive('action', (el, { value, modifiers, expression }, { Alpine, effect, cleanup, evaluate }) => {

        const handleAction = async (e) => {
            e.preventDefault();
            const collection = el.getAttribute(`${prefix}-collection`);
            const record = el.hasAttribute(`${prefix}-record`) ? evaluate(el.getAttribute(`${prefix}-record`)) : null;
            const action = el.getAttribute(`${prefix}-action`);

            const fields = Alpine.$data(el) || {};

            if (el.tagName === 'FORM') {
                const formData = new FormData(el);
                for (const [key, value] of formData.entries()) {
                    fields[key] = value;
                }
            }

            switch (action) {
                case 'create': {
                    try {
                        await db.collection(collection).create(fields);
                    } catch (error) {
                        console.error(error);
                    }
                    break;
                }
                case 'update': {
                    try {
                        await db.collection(collection).update(record, fields);
                    } catch (error) {
                        console.error(error);
                    }
                    break;
                }
                case 'delete': {
                    try {
                        await db.collection(collection).delete(record);
                    } catch (error) {
                        console.error(error);
                    }
                    break;
                }
                case 'logout': {
                    db.authStore.clear();
                    break;
                }
                case 'login': {
                    const username = fields.username;
                    const email = fields.email;
                    const usernameOrEmail = username || email;
                    const password = fields.password;
                    try {
                        await db.collection(collection ?? 'users').authWithPassword(usernameOrEmail, password);
                    } catch (error) {
                        console.error(error);
                    }
                    break;
                }
                case 'oauth2': {
                    const provider = el.getAttribute(`${prefix}-provider`);
                    try {
                        await db.collection(collection ?? 'users').authWithOAuth2({ provider });
                    } catch (error) {
                        console.error(error);
                    }
                    break;
                }
                case 'signup': {
                    const username = fields.username;
                    const email = fields.email;
                    const usernameOrEmail = username || email;
                    const password = fields.password;
                    const passwordConfirm = fields.passwordConfirm || password;
                    try {
                        await db.collection(collection ?? 'users').create({
                            username,
                            email,
                            password,
                            passwordConfirm
                        })
                    } catch (error) {
                        console.error(error);
                    }
                    break;
                }
                default: {
                    break;
                }
            }
        }

        effect(() => {
            switch (el.tagName) {
                case 'FORM': {
                    el.addEventListener('submit', handleAction);
                    break;
                }
                default: {
                    el.addEventListener('click', handleAction);
                    break;
                }
            }
        });
    })

    Alpine.directive('collection', (el, { value, modifiers, expression }, { Alpine, effect, cleanup, evaluate }) => {

        // If the element has the action attribute, we don't want to do anything
        if (el.hasAttribute(`${prefix}-action`)) {
            return;
        }

        const elData = Alpine.$data(el);
        elData[expression] = [];
        effect(async () => {
            try {
                const page = el.getAttribute(`${prefix}-page`) ? Number(el.getAttribute(`${prefix}-page`)) : 1;
                const limit = el.getAttribute(`${prefix}-limit`) ? Number(el.getAttribute(`${prefix}-limit`)) : 500;
                const sort = el.getAttribute(`${prefix}-sort`) ? el.getAttribute(`${prefix}-sort`) : null;
                const filter = el.getAttribute(`${prefix}-filter`) ? JSON.parse(el.getAttribute(`${prefix}-filter`)) : null;
                const expand = el.getAttribute(`${prefix}-expand`) ? JSON.parse(el.getAttribute(`${prefix}-expand`)) : null;
                const fields = el.getAttribute(`${prefix}-fields`) ? JSON.parse(el.getAttribute(`${prefix}-fields`)) : null;
                const realtime = el.hasAttribute(`${prefix}-realtime`);
                const data = await db.collection(expression).getList(page, limit, {
                    sort,
                    filter,
                    expand,
                    fields
                });
                elData[expression] = data.items;
                if (realtime) {
                    db.collection(expression).subscribe('*', function (e) {
                        switch (e.action) {
                            case 'create': {
                                elData[expression].push(e.record);
                                break;
                            }
                            case 'update': {
                                const index = elData[expression].findIndex(record => record.id === e.record.id);
                                if (index !== -1) {
                                    elData[expression][index] = e.record;
                                }
                                break;
                            }
                            case 'delete': {
                                const index = elData[expression].findIndex(record => record.id === e.record.id);
                                if (index !== -1) {
                                    elData[expression].splice(index, 1);
                                }
                                break;
                            }
                        }
                    });
                }
            } catch (error) {
                console.error(error);
            }
        })
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

    // Register a web component to display the admin in an iframe
    class CommradAdmin extends HTMLElement {
        constructor() {
            super();
            const shadow = this.attachShadow({ mode: 'open' });
            const iframe = document.createElement('iframe');
            iframe.src = '/_/';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            shadow.appendChild(iframe);
        }
    }

    customElements.define(`${prefix}-admin`, CommradAdmin);

    register(CommradInput, `${prefix}-input`, ['type'], { shadow: false });


}
  
init();