import fetch from 'node-fetch';
import { FormData } from 'formdata-polyfill/esm.min.js';
import cheerio from 'cheerio';
import _ from 'lodash';
import Config from './Config.js';
import { HttpsProxyAgent } from 'https-proxy-agent';

const BASE_URL = 'https://iqdb.org/';

async function IqDB(url) {
    const form = new FormData();
    form.append('url', url);

    let agent = null
    if (Config.getConfig().proxy.enable) {
        let proxy = 'http://' + Config.getConfig().proxy.host + ':' + Config.getConfig().proxy.port
        agent = new HttpsProxyAgent(proxy)
    }

    const services = await Config.getConfig().IqDB.services;
    const discolor = await Config.getConfig().IqDB.discolor;

    if (services) services.forEach((s, index) => form.append(`service.${index}`, s));
    if (discolor) form.append('forcegray', 'on');

    const response = await fetch(BASE_URL, {
        method: 'POST',
        body: form,
        agent: agent,
    }).then((res) => res.text());

    return parse(response);
}

function parse(body) {
    const $ = cheerio.load(body);
    return _.map($('table'), (result) => {
        const content = $(result).text(),
            [link] = $('td.image > a', result),
            [image] = $('td.image img', result);

        if (!link) return;

        const [, similarity] = content.match(/(\d+%)\s*similarity/) ?? [],
            [, level] = content.match(/\[(\w+)\]/) ?? [],
            [, resolution] = content.match(/(\d+×\d+)/) ?? [];

        return {
            url: new URL(link.attribs.href, BASE_URL).toString(),
            image: new URL(image.attribs.src, BASE_URL).toString(),
            similarity: similarity ? parseFloat(similarity.replace('%', '')) : undefined,
            resolution,
            level: level ? level.toLowerCase() : undefined,
        };
    }).filter((value) => value !== undefined)
        .sort((a, b) => b.similarity - a.similarity);
}

export { IqDB };
