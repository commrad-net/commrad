import Alpine from 'alpinejs'
import PocketBase from 'pocketbase'
import register from 'preact-custom-element';
import { getDataByExpression } from './helpers';
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

    window.$url = (key) => {
        const url = new URL(window.location);

        if (url.searchParams && url.searchParams.has(key)) {
            return url.searchParams.get(key);
        }

        if (window?.$pathParams && window.$pathParams?.[key]) {
            return window?.$pathParams?.[key];
        }

        return null;
    }

    Alpine.magic('url', (el, { Alpine }) => {
        return window.$url;
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
            let collection;

            const closestCollection = el.closest(`[${prefix}-collection]`);
            if (closestCollection) {
                collection = closestCollection.getAttribute(`${prefix}-collection`);
            }

            if (el.hasAttribute(`${prefix}-collection`)) {
                collection = el.getAttribute(`${prefix}-collection`);
            }

            let record;

            const dataStack = Alpine.closestDataStack(el);
            if (dataStack) {
                const data = getDataByExpression(dataStack, el.getAttribute(`${prefix}-value`));
                if (data) {
                    record = data.id;
                }
            }

            const closestRecord = el.closest(`[${prefix}-record]`);
            if (closestRecord) {
                record = closestRecord.getAttribute(`${prefix}-record`);
            }

            if (el.hasAttribute(`${prefix}-record`)) {
                record = el.getAttribute(`${prefix}-record`);
            }

            const action = el.getAttribute(`${prefix}-action`);

            let fields = {};

            switch (el.tagName) {
                case 'FORM': {
                    const formData = new FormData(el);
                    for (const [key, value] of formData.entries()) {
                        fields[key] = value;
                    }
                    break;
                }
                case 'INPUT':
                case 'TEXTAREA':
                case 'SELECT': {
                    let key = el.getAttribute('name');
                    if (el.hasAttribute(`${prefix}-value`)) {
                        const parts = el.getAttribute(`${prefix}-value`).split('.');
                        if (parts.length === 2) {
                            key = parts[1];
                        }
                    }
                    if (key) {
                        fields[key] = el.value;
                    }
                    break;
                }
                default: {
                    const dataStack = Alpine.closestDataStack(el);
                    fields = dataStack[0];
                    break;
                }
            }

            if (Object.keys(fields).length === 0 && fields.constructor === Object) {
                return;
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
                case 'INPUT': {
                    el.addEventListener('input', handleAction);
                    break;
                }
                case 'TEXTAREA':
                case 'SELECT': {
                    el.addEventListener('change', handleAction);
                    break;
                }
                default: {
                    el.addEventListener('click', handleAction);
                    break;
                }
            }
        });

        cleanup(() => {
            switch (el.tagName) {
                case 'FORM': {
                    el.removeEventListener('submit', handleAction);
                    break;
                }
                case 'INPUT': {
                    el.removeEventListener('input', handleAction);
                    break;
                }
                case 'TEXTAREA':
                case 'SELECT': {
                    el.removeEventListener('change', handleAction);
                    break;
                }
                default: {
                    el.removeEventListener('click', handleAction);
                    break;
                }
            }
        })
    })

    Alpine.directive('value', (el, { value, modifiers, expression }, { Alpine, effect, cleanup, evaluate }) => {
        if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') {
            return;
        }
        effect(() => {
            el.value = evaluate(expression);
        });
    });

    Alpine.directive('playing', (el, { value, modifiers, expression }, { Alpine, effect, cleanup, evaluate }) => {
        if (el.tagName !== 'AUDIO' && el.tagName !== 'VIDEO') {
            return;
        }
        effect(() => {
            if (evaluate(expression)) {
                el.play();
            } else {
                el.pause();
            }
        });
    })

    Alpine.directive('href', (el, { value, modifiers, expression }, { Alpine, effect, cleanup, evaluate }) => {
        if (el.tagName !== 'A') {
            return;
        }
        effect(() => {
            el.href = evaluate(expression);
        });
    })

    Alpine.directive('volume', (el, { value, modifiers, expression }, { Alpine, effect, cleanup, evaluate }) => {
        if (el.tagName !== 'AUDIO' && el.tagName !== 'VIDEO') {
            return;
        }
        effect(() => {
            el.volume = evaluate(expression);
        });
    })

    Alpine.directive('src', (el, { value, modifiers, expression }, { Alpine, effect, cleanup, evaluate }) => {

        if (!expression || ( el.tagName !== 'AUDIO' && el.tagName !== 'VIDEO' && el.tagName !== 'IMG' && el.tagName !== 'SOURCE' ) ) {
            return;
        }

        const dataStack = Alpine.closestDataStack(el);

        effect(() => {
            let src;
            if (dataStack) {
                const data = getDataByExpression(dataStack, expression);
                const file = evaluate(expression);
                if (file) {
                    src = `/api/files/${data.collectionId}/${data.id}/${file}`;
                }
            }
            if (src && el.src.includes(src) === false) {
                el.src = src;
            }
        })
    })

    const autoInterpolate = (string) => {
        if (string.includes('$url') && !string.startsWith('`') && !string.endsWith('`')) {
            let newString = string;
            // Get the index of the first $url
            const index = string.indexOf('$url');
            // Add a ${ before the $url
            newString = string.slice(0, index) + "'${" + string.slice(index);
            // Get the index of the first closing parens after the $url
            const closingIndex = newString.indexOf(")", index + 3);
            // Add a closing } after the closing parens, and keep the rest of the string
            newString = newString.slice(0, closingIndex + 1) + "}'" + newString.slice(closingIndex + 1);
            // Wrap the string in backticks
            newString = '`' + newString + '`';
            return newString;
        }
        return string;
    }


    Alpine.directive('collection', (el, { value, modifiers, expression }, { Alpine, effect, cleanup, evaluate }) => {

        // If the element has the action attribute, we don't want to do anything
        if (el.hasAttribute(`${prefix}-action`)) {
            return;
        }

        let collection = expression;
        if (
            collection.includes('.') || 
            ( collection.includes('$') && collection.includes('(') && collection.includes(')') )
        ) {
            collection = evaluate(collection);
        }
        

        const elData = Alpine.$data(el);

        elData[collection] = [];
        elData['error'] = null;
        elData['loading'] = true;
        effect(async () => {
            try {
                const record = el.getAttribute(`${prefix}-record`) ? evaluate(el.getAttribute(`${prefix}-record`)) : null;
                if (record) {
                    elData['record'] = {};
                    const data = await db.collection(collection).getOne(record);
                    elData['loading'] = false;
                    elData['record'] = data;
                    return;
                }

                const page = el.getAttribute(`${prefix}-page`) ? Number(el.getAttribute(`${prefix}-page`)) : 1;
                const limit = el.getAttribute(`${prefix}-limit`) ? Number(el.getAttribute(`${prefix}-limit`)) : 500;
                const sort = el.getAttribute(`${prefix}-sort`) ? el.getAttribute(`${prefix}-sort`) : null;
                const filter = el.getAttribute(`${prefix}-filter`) ? evaluate(autoInterpolate(el.getAttribute(`${prefix}-filter`))) : null;
                const expand = el.getAttribute(`${prefix}-expand`) ? JSON.parse(el.getAttribute(`${prefix}-expand`)) : null;
                const fields = el.getAttribute(`${prefix}-fields`) ? JSON.parse(el.getAttribute(`${prefix}-fields`)) : null;
                const realtime = el.hasAttribute(`${prefix}-realtime`);
                const data = await db.collection(collection).getList(page, limit, {
                    sort,
                    filter,
                    expand,
                    fields
                });
                elData['loading'] = false;
                elData[collection] = data.items;
                if (realtime) {
                    db.collection(collection).subscribe('*', function (e) {
                        switch (e.action) {
                            case 'create': {
                                elData[collection].push(e.record);
                                break;
                            }
                            case 'update': {
                                const index = elData[collection].findIndex(record => record.id === e.record.id);
                                if (index !== -1) {
                                    elData[collection][index] = e.record;
                                }
                                break;
                            }
                            case 'delete': {
                                const index = elData[collection].findIndex(record => record.id === e.record.id);
                                if (index !== -1) {
                                    elData[collection].splice(index, 1);
                                }
                                break;
                            }
                        }
                    });
                }
            } catch (error) {
                // Set error data
                elData['loading'] = false;
                elData['error'] = error.response;
            }
        })
    })

    Alpine.magic('create', (el, { Alpine }) => (collectionIdOrName, bodyurl, options) => {
        return db.collection(collectionIdOrName).create(bodyurl, options);
    })

    Alpine.magic('update', (el, { Alpine }) => (collectionIdOrName, recordId, bodyurl, options) => {
        return db.collection(collectionIdOrName).update(recordId, bodyurl, options);
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