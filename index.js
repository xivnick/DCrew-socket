const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');
const bodyParser = require('body-parser');
const secret = require('./secret.json');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));

app.get('/test', (req, res) => {
    axios.post('http://127.0.0.1/test/',{
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

app.post('/game/update', (req, res) => {
    const room = req.body.room;
    const target = req.body.target;

    io.sockets.in(room).emit('update', target);
    console.log(`[update] update on ${target} of ${room}`);
});

io.on('connection', (socket) => {
    socket.emit('connection');
    console.log(`[conn] client connected: ${socket.id}`);

    socket.on('join', (uid, name, room) => {

        // set socket data
        socket.uid = uid;
        socket.name = name;
        socket.room = room;

        axios.post('http://127.0.0.1/room/user/update',{
            type: 'connect',
            room_id: socket.room,
            user_id: socket.uid,
            x_key: secret["X_KEY"],
        }).then((result) => {
            console.log('[resp]/room/player: ', result.data);
        }).catch((err) => {
            console.log('[err]', err);
        });

        socket.join(socket.room)
        socket.broadcast.to(socket.room).emit('join', socket.name);
        console.log(`[join] user join : ${socket.name}(${socket.id}) to ${socket.room}`);
    });

    socket.on('chat', (msg) => {
        console.log(`[chat] ${socket.name} : ${msg}`);
        socket.broadcast.to(socket.room).emit('chat', socket.name, msg);
    });

    socket.on('disconnect', () => {

        axios.post('http://127.0.0.1/room/user/update',{
            type: 'disconnect',
            room_id: socket.room,
            user_id: socket.uid,
            x_key: secret["X_KEY"],
        }).then((result) => {
            console.log('[resp]/room/player: ', result.data);
        }).catch((err) => {
            console.log('[err]', err);
        });

        if(socket.name) io.sockets.in(socket.room).emit('disconnect', null, socket.name);
        console.log(`[disconn] client disconnected : ${socket.name}(${socket.id})`);
    });
});

const port = 3000

http.listen(port, function(){
    console.log('server on!');
});