const uefi = @import("std").os.uefi;
const Event = uefi.Event;
const Guid = uefi.Guid;

/// UEFI Specification, Version 2.8, 12.7
pub const AbsolutePointerProtocol = extern struct {
    _reset: extern fn (*const AbsolutePointerProtocol, bool) usize,
    _get_state: extern fn (*const AbsolutePointerProtocol, *AbsolutePointerState) usize,
    wait_for_input: Event,
    mode: *AbsolutePointerMode,

    pub fn reset(self: *const AbsolutePointerProtocol, verify: bool) usize {
        return self._reset(self, verify);
    }

    pub fn getState(self: *const AbsolutePointerProtocol, state: *AbsolutePointerState) usize {
        return self._get_state(self, state);
    }

    pub const guid align(8) = Guid{
        .time_low = 0x8d59d32b,
        .time_mid = 0xc655,
        .time_high_and_version = 0x4ae9,
        .clock_seq_high_and_reserved = 0x9b,
        .clock_seq_low = 0x15,
        .node = [_]u8{ 0xf2, 0x59, 0x04, 0x99, 0x2a, 0x43 },
    };
};

pub const AbsolutePointerMode = extern struct {
    absolute_min_x: u64,
    absolute_min_y: u64,
    absolute_min_z: u64,
    absolute_max_x: u64,
    absolute_max_y: u64,
    absolute_max_z: u64,
    attributes: packed struct {
        supports_alt_active: bool,
        supports_pressure_as_z: bool,
        _pad1: u30,
    },
};

pub const AbsolutePointerState = extern struct {
    current_x: u64 = undefined,
    current_y: u64 = undefined,
    current_z: u64 = undefined,
    active_buttons: packed struct {
        touch_active: bool,
        alt_active: bool,
        _pad1: u30,
    } = undefined,
};
