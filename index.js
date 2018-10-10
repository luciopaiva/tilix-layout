
// taken from https://stackoverflow.com/a/2117523/778272
function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

class Terminal {

    constructor (command = "") {
        this.directory = "";
        this.height = 0;
        this.overrideCommand = command;
        this.profile = uuidv4();
        this.readOnly = false;
        this.synchronizedInput = true;
        this.type = "Terminal";
        // this.uuid = "";
        this.width = 0;

        // uncomment if you want to set this field as well
        // this.title = "${id}: ${title}";
    }
}

class Pane {

    /**
     * @param {Pane|Terminal} left
     * @param {Pane|Terminal} right
     * @param {Number} orientation - either `0` (horizontal pane) or `1` (vertical pane)
     */
    constructor (left, right, orientation) {
        /** @type {Terminal} */
        this.child1 = left;
        /** @type {Terminal} */
        this.child2 = right;
        this.orientation = orientation;  // 0 === row, 1 === column
        this.position = 0;
        this.ratio = 0;  // [0, 1]
        this.type = "Paned";
    }
}

Pane.HORIZONTAL = 0;
Pane.VERTICAL = 1;

class Session {

    /**
     * @param {Pane|Terminal} paneOrSingleTerminal
     */
    constructor (paneOrSingleTerminal) {
        this.child = paneOrSingleTerminal;
        this.height = 0;
        this.name = "Default";
        this.synchronizedInput = false;
        this.type = "Session";
        this.uuid = "";
        this.version = "1.0";
        this.width = 0;
    }
}

const DEBUG = false;
function debug(...msg) {
    if (DEBUG) {
        console.info(...msg);
    }
}

class App {

    constructor() {
        this.commandPrefix = "ssh ";
        this.hostNames = [];
        this.gridWidth = 0;
        this.gridHeight = 0;
        this.horizontalRatio = 0;
        this.verticalRatio = 0;
        this.terminalWidth = 0;
        this.terminalHeight = 0;

        this.machinesElement = document.getElementById("machines");
        this.scriptElement = document.getElementById("script");
        this.demoElement = document.getElementById("demo");
        this.downloadButton = document.getElementById("download-button");
        this.downloadButton.addEventListener("click", () => this.download());

        // generate demo machine names
        this.machinesElement.value = Array.from(Array(15), (e, i) => `machine${i + 1}`).join("\n");

        this.machinesElement.addEventListener("input", () => this.update());
        this.update();
    }

    makeCommand(hostName) {
        return this.commandPrefix + hostName;
    }

    makeTerminal(x, y) {
        const hostNameIndex = this.gridWidth * y + x;

        if (hostNameIndex >= this.hostNames.length) {
            return null;  // no such terminal
        }

        const hostName = this.hostNames[hostNameIndex];
        const command = this.makeCommand(hostName);
        debug(`Terminal [${x},${y}]: ${command}`);
        const terminal = new Terminal(command);
        terminal.width = this.terminalWidth;
        terminal.height = this.terminalHeight;
        return terminal;
    }

    makePaneIfNeeded(item1, item2, orientation) {
        if (item1 === null && item2 === null) {
            return null;
        } else if (item1 === null) {
            return item2;
        } else if (item2 === null) {
            return item1;
        }
        const pane = new Pane(item1, item2, orientation);
        pane.ratio = orientation === Pane.HORIZONTAL ? this.horizontalRatio : this.verticalRatio;
        return pane;
    }

    partition(x, y, width, height) {
        if (width === 1 && height === 1) {
            return this.makeTerminal(x, y);
        }
        debug(...Array.from(arguments));

        if (width === 1) {
            // split in the vertical center
            const firstHalfHeight = Math.ceil(height / 2);
            const secondHalfHeight = height - firstHalfHeight;

            const top = this.partition(x, y, width, firstHalfHeight);
            const bottom = this.partition(x, y + firstHalfHeight, width, secondHalfHeight);
            return this.makePaneIfNeeded(top, bottom, Pane.VERTICAL);
        } else {
            // split in the horizontal center
            const firstHalfWidth = Math.ceil(width / 2);
            const secondHalfWidth = width - firstHalfWidth;

            const left = this.partition(x, y, firstHalfWidth, height);
            const bottom = this.partition(x + firstHalfWidth, y, secondHalfWidth, height);
            return this.makePaneIfNeeded(left, bottom, Pane.HORIZONTAL);
        }
    }

    updateDemo(model, parentElement) {
        if (model instanceof Pane) {
            const div = document.createElement("div");
            div.classList.add(model.orientation === Pane.HORIZONTAL ? "hpane" : "vpane");
            parentElement.appendChild(div);
            this.updateDemo(model.child1, div);
            this.updateDemo(model.child2, div);
        } else if (model instanceof Terminal) {
            const div = document.createElement("div");
            div.classList.add("terminal");
            div.innerText = model.overrideCommand;
            parentElement.appendChild(div);
        }
    }

    update() {
        this.scriptElement.innerText = "";

        this.hostNames = this.machinesElement.value
            .split("\n").map(line => line.trim())
            .filter(line => line.length > 0);

        if (this.hostNames.length === 0) {
            return;
        }

        this.gridWidth = Math.ceil(Math.sqrt(this.hostNames.length));
        this.gridHeight = Math.ceil(this.hostNames.length / this.gridWidth);
        this.horizontalRatio = 0.5;  // 1 / this.gridWidth;
        this.verticalRatio = 0.5;  // 1 / this.gridHeight;
        this.terminalWidth = Math.floor(App.SCREEN_WIDTH / this.gridWidth);
        this.terminalHeight = Math.floor(App.SCREEN_HEIGHT / this.gridHeight);
        debug(`Making a ${this.gridWidth}x${this.gridHeight} grid`);

        // hostNames.length === 1 ? this.makeTerminal() : this.makePane()
        const session = new Session(this.partition(0, 0, this.gridWidth, this.gridHeight));
        session.width = App.SCREEN_WIDTH;
        session.height = App.SCREEN_HEIGHT;
        debug(session);

        this.demoElement.innerHTML = "";
        this.updateDemo(session.child, this.demoElement);

        this.scriptElement.innerText = JSON.stringify(session, null, 4);
    }

    download() {
        App.downloadAsJson(this.scriptElement.innerText, "tilix.json");
    }

    static downloadAsJson(data, fileName) {
        App.download(data, fileName, "application/json");
    }

    static download(data, fileName, type) {
        const file = new Blob([data], { type: type });
        const a = document.createElement("a");
        const url = URL.createObjectURL(file);
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            a.remove();
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}

App.SCREEN_WIDTH = 1920;
App.SCREEN_HEIGHT = 1006;

new App();
