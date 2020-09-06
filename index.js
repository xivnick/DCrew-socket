const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');
const bodyParser = require('body-parser');
const secret = require('./secret.json');

const base_url = 'http://127.0.0.1/api'

let settings = {};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));

app.get('/test', (req, res) => {
    axios.post(base_url + '/test/',{
        message: 'test',
        x_key: secret["X_KEY"],
    }).then((result) => {
        console.log('data:', result.data);
        res.json(result.data);
    }).catch((err) => {
        console.log('err:', err);
        res.json(err);
    });
})

app.post('/room/update', (req, res) => {
    const room = req.body.room;
    const target = req.body.target;

    io.sockets.in(room).emit('update', target);
    console.log(`[update] update on ${target} of ${room}`);

    res.json();
});

app.post('/rooms/update', (req, res) => {
    const rooms = req.body.rooms;
    const target = req.body.target;

    for(room of rooms){
        io.sockets.in(room).emit('update', target);
    }
    console.log(`[update] update on ${target} of ${rooms}`);

    res.json();
});

app.post('/room/delete', (req, res) => {
    const room = req.body.room;

    settings[room] = {};
    io.sockets.in(room).emit('update', 'delete');
    io.sockets.in(0).emit('update', 'all');
    res.json();
})

io.on('connection', (socket) => {
    socket.emit('connection');
    console.log(`[conn] client connected: ${socket.id}`);

    socket.on('join', (uid, name, room) => {

        // set socket data
        socket.uid = uid;
        socket.name = name;
        socket.room = room || 0;

        if(room > 0){
            axios.post(base_url + '/room/user/update/',{
                type: 'connect',
                room_id: socket.room,
                user_id: socket.uid,
                x_key: secret["X_KEY"],
            }).then((result) => {
                console.log('[resp]/room/player: ', result.data);
            }).catch((err) => {
                console.log('[err]', err);
            });
        }

        socket.join(socket.room)
        socket.broadcast.to(socket.room).emit('join', socket.name);
        socket.emit('update', 'all');
        console.log(`[join] user join : ${socket.name}(${socket.id}) to ${socket.room}`);

        if(socket.room in settings){
            for(name in settings[room]){
                socket.emit('setting', name, settings[room][name]);
            }
        }
    });

    socket.on('chat', (msg) => {
        console.log(`[chat] ${socket.name} : ${msg}`);
        socket.broadcast.to(socket.room).emit('chat', socket.name, msg);
    });

    socket.on('setting', (setting) => {

        if(!(socket.room in settings)) settings[socket.room] = {};
        settings[socket.room][socket.name] = setting;

        socket.broadcast.to(socket.room).emit('setting', socket.name, setting);
        console.log(`[sett] changed setting on ${socket.room} by ${socket.name}`);
    });

    socket.on('disconnect', () => {

        if(socket.room > 0){
            axios.post(base_url + '/room/user/update/',{
                type: 'disconnect',
                room_id: socket.room,
                user_id: socket.uid,
                x_key: secret["X_KEY"],
            }).then((result) => {
                console.log('[resp]/room/player: ', result.data);
            }).catch((err) => {
                console.log('[err]', err);
            });
        }

        if(socket.name) io.sockets.in(socket.room).emit('disconnect', null, socket.name);
        console.log(`[disconn] client disconnected : ${socket.name}(${socket.id})`);
    });
});

const port = 3000

http.listen(port, function(){
    console.log('server on!');
});