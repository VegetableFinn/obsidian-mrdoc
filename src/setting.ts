import * as https from "https";
import * as fs from "fs";
import { App, PluginSettingTab, Setting, Notice, Modal, setIcon } from "obsidian";
import MrdocPlugin from "./main";
import type { TextComponent } from "obsidian";
import { MrdocApiReq } from "./api";
import { processMrdocUrl } from "./utils";

// 客户端证书配置
const clientCertOptions = {
    key: "path/to/client-key.pem",
    cert: "path/to/client-cert.pem",
    ca: "path/to/ca-cert.pem", // 可选，如果需要验证服务器证书
};

// 封装支持客户端证书的请求函数
async function requestWithClientCert(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = https.request(
            { ...clientCertOptions, method: "GET", url },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error("Failed to parse JSON response"));
                    }
                });
            }
        );
        req.on("error", (err) => reject(err));
        req.end();
    });
}

export interface MrdocPluginSettings {
    mrdocUrl: string;
    mrdocToken: string;
    saveImg: boolean;
    applyImage: boolean;
    projects: object;
    defaultProject: string;
    fileMap: Array<any>;
    realtimeSync: boolean;
    pulling: boolean;
    pushing: boolean;
}

export const DEFAULT_SETTINGS: MrdocPluginSettings = {
    mrdocUrl: "",
    mrdocToken: "",
    saveImg: true,
    applyImage: false,
    projects: [],
    defaultProject: "",
    fileMap: [],
    realtimeSync: false,
    pulling: false,
    pushing: false,
};

// 定义一个密码输入框显示函数
const wrapTextWithPasswordHide = (text: TextComponent) => {
    const hider = text.inputEl.insertAdjacentElement("afterend", createSpan());
    setIcon(hider, "eye");
    hider.addEventListener("click", () => {
        const isText = text.inputEl.getAttribute("type") === "text";
        const icon = isText ? "eye" : "eye-off";
        setIcon(hider, icon);
        text.inputEl.setAttribute("type", isText ? "password" : "text");
        text.inputEl.focus();
    });

    text.inputEl.setAttribute("type", "password");
    return text;
};

// 实例化一个插件设置面板
export class MrdocSettingTab extends PluginSettingTab {
    plugin: MrdocPlugin;

    constructor(app: App, plugin: MrdocPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h1", { text: "MrDoc" });

        new Setting(containerEl)
            .setName("MrDoc URL")
            .setClass("mrdoc-settings-input")
            .setDesc("请输入你的 MrDoc URL 地址")
            .addText((text) =>
                text
                    .setPlaceholder("例如：https://doc.mrdoc.pro")
                    .setValue(this.plugin.settings.mrdocUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.mrdocUrl = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("用户 Token")
            .setClass("mrdoc-settings-input")
            .setDesc("请输入你的 MrDoc 用户 Token")
            .addText((text) => {
                wrapTextWithPasswordHide(text);
                text.setPlaceholder("请输入你的 MrDoc 用户 Token")
                    .setValue(this.plugin.settings.mrdocToken)
                    .onChange(async (value) => {
                        this.plugin.settings.mrdocToken = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("检查可否连接")
            .setClass("mrdoc-settings-input")
            .setDesc("检查填写的配置是否可连接")
            .addButton((button) => {
                button.setButtonText("检查").onClick(async () => {
                    try {
                        new Notice("正在测试连接……");
                        const mrdocUrl = processMrdocUrl(this.plugin.settings.mrdocUrl);
                        const mrdocToken = this.plugin.settings.mrdocToken;

                        if (!mrdocUrl || !mrdocToken) {
                            throw new Error("MrDoc URL and Token are required");
                        }

                        button.setDisabled(true);
                        const apiUrl = `${mrdocUrl}/api/check_token/?token=${mrdocToken}`;

                        // 使用客户端证书请求
                        const response = await requestWithClientCert(apiUrl);
                        if (response.status) {
                            new Notice("测试连接成功！");
                        } else {
                            new Notice("测试连接失败，请检查配置！");
                        }
                    } catch (error) {
                        console.error("Error during API request:", error);
                        new Notice(`Error during API request: ${error.message}`);
                    } finally {
                        button.setDisabled(false);
                    }
                });
            });
    }
}
