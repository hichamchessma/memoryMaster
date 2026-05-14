let _io = null;
module.exports = {
  set:  (io)           => { _io = io; },
  emit: (event, data)  => { if (_io) _io.emit(event, data); },
  getBroadcast: ()     => _io ? _io.emit.bind(_io) : null,
};
