import fetch from "node-fetch";
import { FormData } from "formdata-polyfill/esm.min.js";
import { load } from "cheerio";
import { fileFromSync } from "fetch-blob/from.js";
import downloadImage from "../utils/download.js";
import _ from "lodash";
import Config from "./Config.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import https from "https";

const PROXY_URL = "https://ascii2d.obfs.dev";
const BASE_URL = "https://ascii2d.net";

async function Ascii2d(url) {
    const imagePath = await downloadImage(url);

    const form = new FormData();
    form.append("file", fileFromSync(imagePath));

    let agent = null;
    if (Config.getConfig().proxy.enable) {
        let proxy = "http://" + Config.getConfig().proxy.host + ":" + Config.getConfig().proxy.port;
        agent = new HttpsProxyAgent(proxy);
    } else {
        agent = new https.Agent({ family: 4, rejectUnauthorized: false });
    }

    const type = await Config.getConfig().Ascii2d.type;
    const proxyFlag = await Config.getConfig().Ascii2d.proxy;
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,ja;q=0.7",
        "Origin": "https://ascii2d.net",
        "Referer": "https://ascii2d.net/",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1"
    };

    const colorResponse = await fetch(
        `${proxyFlag ? PROXY_URL : BASE_URL}/search/file`,
        {
            method: "POST",
            headers: headers,
            body: form,
            agent: agent,
        }
    );

    if (colorResponse.status === 200) {
        let response;
        if (type === "color") {
            response = await colorResponse.text();
        } else {
            const bovwUrl = colorResponse.url.replace("/color/", "/bovw/");
            response = await fetch(bovwUrl, { headers: headers, agent: agent }).then((res) => res.text());
        }
        return parse(response);
    } else {
        throw new Error("[Ascii2d] 请求失败，状态码：" + colorResponse.status);
    }
}

function parse(body) {
    const $ = load(body, { decodeEntities: true });
    return _.map($(".item-box"), (item) => {
        const detail = $(".detail-box", item),
            hash = $(".hash", item),
            info = $(".info-box > .text-muted", item),
            [ image ] = $(".image-box > img", item),
            [ source, author ] = $("a[rel=noopener]", detail);

        if (!source && !author) return;

        return {
            hash: hash.text(),
            info: info.text(),
            image: new URL(image.attribs["src"] ?? image.attribs["data-cfsrc"], BASE_URL).toString(),
            source: source ? { link: source.attribs.href, text: $(source).text() } : undefined,
            author: author ? { link: author.attribs.href, text: $(author).text() } : undefined,
        };
    }).filter((value) => value !== undefined);
}

export { Ascii2d };