const express = require('express');
    const app = express();
const pm2 = require('pm2');
const fs = require('fs');
const Database = require('nedb');

const ports = new Database({ filename: 'ports.db', autoload: true });

let port;
    ports.findOne({ server: 'server-manager' }, (err, output) => port = output.port);

app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

setTimeout(() => app.listen(port, () => console.log('Server started on port 5000')), 1000);

app.get('/', (request, response) => {
    const servers = new Array();

    fs.readdir('./servers', (err, files) => {
        if (err) { console.log(err) }
        else {
            files.forEach(async file => {
                const newPort = await new Promise(resolve => ports.findOne({ server: file }, (err, output) => resolve(output == null ? null : output.port)));

                servers.push({
                    server: file,
                    status: null,
                    monitor: null,
                    port: newPort
                });
            });

            setTimeout(() => {
                response.render('index', {
                    servers
                });
            }, 1000);
        }
    });
});

app.get('/start/:serverName', (request, response) => {
    const serverName = request.params.serverName;

    pm2.start({
        script: `./servers/${serverName}/server.js`,
        name: serverName
    }, (err, cb) => { if (err) { console.log(err) } });

    response.redirect('/');
});

app.get('/stop/:serverName', (request, response) => {
    const serverName = request.params.serverName;

    pm2.stop(serverName, (err, cb) => { if (err) { console.log(err) } });

    response.redirect('/');
});

app.get('/restart/:serverName', (request, response) => {
    const serverName = request.params.serverName;

    pm2.restart(serverName, (err, cb) => { if (err) { console.log(err) } });

    response.redirect('/');
});

app.get('/delete/:serverName', (request, response) => {
    const serverName = request.params.serverName;

    pm2.delete(serverName, (err, cb) => { if (err) { console.log(err) } });

    fs.rmdirSync(`./servers/${serverName}`, { recursive: true });

    ports.remove({ server: serverName });

    response.redirect('/');
});

app.get('/getStatus', (request, response) => {
    const servers = new Array();

    pm2.list((err, list) => {
        list.forEach(server => {
            servers.push({
                server: server.name,
                status: server.pm2_env.status,
                monitor: server.monit
            });
        });

        response.json(servers);
    });
});

app.post('/newServer', async (request, response) => {
    const data = request.body;
    let newPort = 5000;

    ports.find({}, (err, result) => {
        for (let i = newPort; i < 6000; i++) {
            const found = result.find(currentPort => currentPort.port == i);
            if (found == null || found == undefined) {
                newPort = i;
                break;
            }
        }
    });

    setTimeout(() => {
        fs.mkdir(`./servers/${data.name}`, err => { if (err) { console.log(err) } });
        fs.writeFile(`./servers/${data.name}/server.js`, `const port = process.env.port || ${newPort};`, err => { if (err) { console.log(err) } });

        ports.insert({
            server: data.name,
            port: newPort
        });
        
        response.redirect('/');
    }, 500);
});