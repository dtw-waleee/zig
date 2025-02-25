const uefi = @import("std").os.uefi;
const Event = uefi.Event;
const Guid = uefi.Guid;

/// UEFI Specification, Version 2.8, 12.3
pub const SimpleTextInputExProtocol = extern struct {
    _reset: extern fn (*const SimpleTextInputExProtocol, bool) usize,
    _read_key_stroke_ex: extern fn (*const SimpleTextInputExProtocol, *KeyData) usize,
    wait_for_key_ex: Event,
    _set_state: extern fn (*const SimpleTextInputExProtocol, *const u8) usize,
    _register_key_notify: extern fn (*const SimpleTextInputExProtocol, *const KeyData, extern fn (*const KeyData) usize, **c_void) usize,
    _unregister_key_notify: extern fn (*const SimpleTextInputExProtocol, *const c_void) usize,

    pub fn reset(self: *const SimpleTextInputExProtocol, verify: bool) usize {
        return self._reset(self, verify);
    }

    pub fn readKeyStrokeEx(self: *const SimpleTextInputExProtocol, key_data: *KeyData) usize {
        return self._read_key_stroke_ex(self, key_data);
    }

    pub fn setState(self: *const SimpleTextInputExProtocol, state: *const u8) usize {
        return self._set_state(self, state);
    }

    pub fn registerKeyNotify(self: *const SimpleTextInputExProtocol, key_data: *const KeyData, notify: extern fn (*const KeyData) usize, handle: **c_void) usize {
        return self._register_key_notify(self, key_data, notify, handle);
    }

    pub fn unregisterKeyNotify(self: *const SimpleTextInputExProtocol, handle: *const c_void) usize {
        return self._unregister_key_notify(self, handle);
    }

    pub const guid align(8) = Guid{
        .time_low = 0xdd9e7534,
        .time_mid = 0x7762,
        .time_high_and_version = 0x4698,
        .clock_seq_high_and_reserved = 0x8c,
        .clock_seq_low = 0x14,
        .node = [_]u8{ 0xf5, 0x85, 0x17, 0xa6, 0x25, 0xaa },
    };
};

pub const KeyData = extern struct {
    key: InputKey = undefined,
    key_state: KeyState = undefined,
};

pub const KeyState = extern struct {
    key_shift_state: packed struct {
        right_shift_pressed: bool,
        left_shift_pressed: bool,
        right_control_pressed: bool,
        left_control_pressed: bool,
        right_alt_pressed: bool,
        left_alt_pressed: bool,
        right_logo_pressed: bool,
        left_logo_pressed: bool,
        menu_key_pressed: bool,
        sys_req_pressed: bool,
        _pad1: u21,
        shift_state_valid: bool,
    },
    key_toggle_state: packed struct {
        scroll_lock_active: bool,
        num_lock_active: bool,
        caps_lock_active: bool,
        _pad1: u3,
        key_state_exposed: bool,
        toggle_state_valid: bool,
    },
};

pub const InputKey = extern struct {
    scan_code: u16,
    unicode_char: u16,
};
