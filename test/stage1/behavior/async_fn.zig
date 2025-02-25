const std = @import("std");
const builtin = @import("builtin");
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;

var global_x: i32 = 1;

test "simple coroutine suspend and resume" {
    var frame = async simpleAsyncFn();
    expect(global_x == 2);
    resume frame;
    expect(global_x == 3);
    const af: anyframe->void = &frame;
    resume frame;
    expect(global_x == 4);
}
fn simpleAsyncFn() void {
    global_x += 1;
    suspend;
    global_x += 1;
    suspend;
    global_x += 1;
}

var global_y: i32 = 1;

test "pass parameter to coroutine" {
    var p = async simpleAsyncFnWithArg(2);
    expect(global_y == 3);
    resume p;
    expect(global_y == 5);
}
fn simpleAsyncFnWithArg(delta: i32) void {
    global_y += delta;
    suspend;
    global_y += delta;
}

test "suspend at end of function" {
    const S = struct {
        var x: i32 = 1;

        fn doTheTest() void {
            expect(x == 1);
            const p = async suspendAtEnd();
            expect(x == 2);
        }

        fn suspendAtEnd() void {
            x += 1;
            suspend;
        }
    };
    S.doTheTest();
}

test "local variable in async function" {
    const S = struct {
        var x: i32 = 0;

        fn doTheTest() void {
            expect(x == 0);
            var p = async add(1, 2);
            expect(x == 0);
            resume p;
            expect(x == 0);
            resume p;
            expect(x == 0);
            resume p;
            expect(x == 3);
        }

        fn add(a: i32, b: i32) void {
            var accum: i32 = 0;
            suspend;
            accum += a;
            suspend;
            accum += b;
            suspend;
            x = accum;
        }
    };
    S.doTheTest();
}

test "calling an inferred async function" {
    const S = struct {
        var x: i32 = 1;
        var other_frame: *@Frame(other) = undefined;

        fn doTheTest() void {
            _ = async first();
            expect(x == 1);
            resume other_frame.*;
            expect(x == 2);
        }

        fn first() void {
            other();
        }
        fn other() void {
            other_frame = @frame();
            suspend;
            x += 1;
        }
    };
    S.doTheTest();
}

test "@frameSize" {
    const S = struct {
        fn doTheTest() void {
            {
                var ptr = @ptrCast(async fn (i32) void, other);
                const size = @frameSize(ptr);
                expect(size == @sizeOf(@Frame(other)));
            }
            {
                var ptr = @ptrCast(async fn () void, first);
                const size = @frameSize(ptr);
                expect(size == @sizeOf(@Frame(first)));
            }
        }

        fn first() void {
            other(1);
        }
        fn other(param: i32) void {
            var local: i32 = undefined;
            suspend;
        }
    };
    S.doTheTest();
}

test "coroutine suspend, resume" {
    const S = struct {
        var frame: anyframe = undefined;

        fn doTheTest() void {
            _ = async amain();
            seq('d');
            resume frame;
            seq('h');

            expect(std.mem.eql(u8, points, "abcdefgh"));
        }

        fn amain() void {
            seq('a');
            var f = async testAsyncSeq();
            seq('c');
            await f;
            seq('g');
        }

        fn testAsyncSeq() void {
            defer seq('f');

            seq('b');
            suspend {
                frame = @frame();
            }
            seq('e');
        }
        var points = [_]u8{'x'} ** "abcdefgh".len;
        var index: usize = 0;

        fn seq(c: u8) void {
            points[index] = c;
            index += 1;
        }
    };
    S.doTheTest();
}

test "coroutine suspend with block" {
    const p = async testSuspendBlock();
    expect(!global_result);
    resume a_promise;
    expect(global_result);
}

var a_promise: anyframe = undefined;
var global_result = false;
async fn testSuspendBlock() void {
    suspend {
        comptime expect(@typeOf(@frame()) == *@Frame(testSuspendBlock));
        a_promise = @frame();
    }

    // Test to make sure that @frame() works as advertised (issue #1296)
    // var our_handle: anyframe = @frame();
    expect(a_promise == anyframe(@frame()));

    global_result = true;
}

var await_a_promise: anyframe = undefined;
var await_final_result: i32 = 0;

test "coroutine await" {
    await_seq('a');
    var p = async await_amain();
    await_seq('f');
    resume await_a_promise;
    await_seq('i');
    expect(await_final_result == 1234);
    expect(std.mem.eql(u8, await_points, "abcdefghi"));
}
async fn await_amain() void {
    await_seq('b');
    var p = async await_another();
    await_seq('e');
    await_final_result = await p;
    await_seq('h');
}
async fn await_another() i32 {
    await_seq('c');
    suspend {
        await_seq('d');
        await_a_promise = @frame();
    }
    await_seq('g');
    return 1234;
}

var await_points = [_]u8{0} ** "abcdefghi".len;
var await_seq_index: usize = 0;

fn await_seq(c: u8) void {
    await_points[await_seq_index] = c;
    await_seq_index += 1;
}

var early_final_result: i32 = 0;

test "coroutine await early return" {
    early_seq('a');
    var p = async early_amain();
    early_seq('f');
    expect(early_final_result == 1234);
    expect(std.mem.eql(u8, early_points, "abcdef"));
}
async fn early_amain() void {
    early_seq('b');
    var p = async early_another();
    early_seq('d');
    early_final_result = await p;
    early_seq('e');
}
async fn early_another() i32 {
    early_seq('c');
    return 1234;
}

var early_points = [_]u8{0} ** "abcdef".len;
var early_seq_index: usize = 0;

fn early_seq(c: u8) void {
    early_points[early_seq_index] = c;
    early_seq_index += 1;
}

test "async function with dot syntax" {
    const S = struct {
        var y: i32 = 1;
        async fn foo() void {
            y += 1;
            suspend;
        }
    };
    const p = async S.foo();
    expect(S.y == 2);
}

test "async fn pointer in a struct field" {
    var data: i32 = 1;
    const Foo = struct {
        bar: async fn (*i32) void,
    };
    var foo = Foo{ .bar = simpleAsyncFn2 };
    var bytes: [64]u8 align(16) = undefined;
    const f = @asyncCall(&bytes, {}, foo.bar, &data);
    comptime expect(@typeOf(f) == anyframe->void);
    expect(data == 2);
    resume f;
    expect(data == 4);
    _ = async doTheAwait(f);
    expect(data == 4);
}

fn doTheAwait(f: anyframe->void) void {
    await f;
}

async fn simpleAsyncFn2(y: *i32) void {
    defer y.* += 2;
    y.* += 1;
    suspend;
}

test "@asyncCall with return type" {
    const Foo = struct {
        bar: async fn () i32,

        var global_frame: anyframe = undefined;

        async fn middle() i32 {
            return afunc();
        }

        fn afunc() i32 {
            global_frame = @frame();
            suspend;
            return 1234;
        }
    };
    var foo = Foo{ .bar = Foo.middle };
    var bytes: [150]u8 align(16) = undefined;
    var aresult: i32 = 0;
    _ = @asyncCall(&bytes, &aresult, foo.bar);
    expect(aresult == 0);
    resume Foo.global_frame;
    expect(aresult == 1234);
}

test "async fn with inferred error set" {
    const S = struct {
        var global_frame: anyframe = undefined;

        fn doTheTest() void {
            var frame: [1]@Frame(middle) = undefined;
            var fn_ptr = middle;
            var result: @typeOf(fn_ptr).ReturnType.ErrorSet!void = undefined;
            _ = @asyncCall(@sliceToBytes(frame[0..]), &result, fn_ptr);
            resume global_frame;
            std.testing.expectError(error.Fail, result);
        }

        async fn middle() !void {
            var f = async middle2();
            return await f;
        }

        fn middle2() !void {
            return failing();
        }

        fn failing() !void {
            global_frame = @frame();
            suspend;
            return error.Fail;
        }
    };
    S.doTheTest();
}

test "error return trace across suspend points - early return" {
    const p = nonFailing();
    resume p;
    const p2 = async printTrace(p);
}

test "error return trace across suspend points - async return" {
    const p = nonFailing();
    const p2 = async printTrace(p);
    resume p;
}

fn nonFailing() (anyframe->anyerror!void) {
    const Static = struct {
        var frame: @Frame(suspendThenFail) = undefined;
    };
    Static.frame = async suspendThenFail();
    return &Static.frame;
}
async fn suspendThenFail() anyerror!void {
    suspend;
    return error.Fail;
}
async fn printTrace(p: anyframe->(anyerror!void)) void {
    (await p) catch |e| {
        std.testing.expect(e == error.Fail);
        if (@errorReturnTrace()) |trace| {
            expect(trace.index == 1);
        } else switch (builtin.mode) {
            .Debug, .ReleaseSafe => @panic("expected return trace"),
            .ReleaseFast, .ReleaseSmall => {},
        }
    };
}

test "break from suspend" {
    var my_result: i32 = 1;
    const p = async testBreakFromSuspend(&my_result);
    std.testing.expect(my_result == 2);
}
async fn testBreakFromSuspend(my_result: *i32) void {
    suspend {
        resume @frame();
    }
    my_result.* += 1;
    suspend;
    my_result.* += 1;
}

test "heap allocated async function frame" {
    const S = struct {
        var x: i32 = 42;

        fn doTheTest() !void {
            const frame = try std.heap.direct_allocator.create(@Frame(someFunc));
            defer std.heap.direct_allocator.destroy(frame);

            expect(x == 42);
            frame.* = async someFunc();
            expect(x == 43);
            resume frame;
            expect(x == 44);
        }

        fn someFunc() void {
            x += 1;
            suspend;
            x += 1;
        }
    };
    try S.doTheTest();
}

test "async function call return value" {
    const S = struct {
        var frame: anyframe = undefined;
        var pt = Point{ .x = 10, .y = 11 };

        fn doTheTest() void {
            expectEqual(pt.x, 10);
            expectEqual(pt.y, 11);
            _ = async first();
            expectEqual(pt.x, 10);
            expectEqual(pt.y, 11);
            resume frame;
            expectEqual(pt.x, 1);
            expectEqual(pt.y, 2);
        }

        fn first() void {
            pt = second(1, 2);
        }

        fn second(x: i32, y: i32) Point {
            return other(x, y);
        }

        fn other(x: i32, y: i32) Point {
            frame = @frame();
            suspend;
            return Point{
                .x = x,
                .y = y,
            };
        }

        const Point = struct {
            x: i32,
            y: i32,
        };
    };
    S.doTheTest();
}

test "suspension points inside branching control flow" {
    const S = struct {
        var result: i32 = 10;

        fn doTheTest() void {
            expect(10 == result);
            var frame = async func(true);
            expect(10 == result);
            resume frame;
            expect(11 == result);
            resume frame;
            expect(12 == result);
            resume frame;
            expect(13 == result);
        }

        fn func(b: bool) void {
            while (b) {
                suspend;
                result += 1;
            }
        }
    };
    S.doTheTest();
}

test "call async function which has struct return type" {
    const S = struct {
        var frame: anyframe = undefined;

        fn doTheTest() void {
            _ = async atest();
            resume frame;
        }

        fn atest() void {
            const result = func();
            expect(result.x == 5);
            expect(result.y == 6);
        }

        const Point = struct {
            x: usize,
            y: usize,
        };

        fn func() Point {
            suspend {
                frame = @frame();
            }
            return Point{
                .x = 5,
                .y = 6,
            };
        }
    };
    S.doTheTest();
}

test "pass string literal to async function" {
    const S = struct {
        var frame: anyframe = undefined;
        var ok: bool = false;

        fn doTheTest() void {
            _ = async hello("hello");
            resume frame;
            expect(ok);
        }

        fn hello(msg: []const u8) void {
            frame = @frame();
            suspend;
            expectEqual(([]const u8)("hello"), msg);
            ok = true;
        }
    };
    S.doTheTest();
}

test "await inside an errdefer" {
    const S = struct {
        var frame: anyframe = undefined;

        fn doTheTest() void {
            _ = async amainWrap();
            resume frame;
        }

        fn amainWrap() !void {
            var foo = async func();
            errdefer await foo;
            return error.Bad;
        }

        fn func() void {
            frame = @frame();
            suspend;
        }
    };
    S.doTheTest();
}

test "try in an async function with error union and non-zero-bit payload" {
    const S = struct {
        var frame: anyframe = undefined;
        var ok = false;

        fn doTheTest() void {
            _ = async amain();
            resume frame;
            expect(ok);
        }

        fn amain() void {
            std.testing.expectError(error.Bad, theProblem());
            ok = true;
        }

        fn theProblem() ![]u8 {
            frame = @frame();
            suspend;
            const result = try other();
            return result;
        }

        fn other() ![]u8 {
            return error.Bad;
        }
    };
    S.doTheTest();
}

test "returning a const error from async function" {
    const S = struct {
        var frame: anyframe = undefined;
        var ok = false;

        fn doTheTest() void {
            _ = async amain();
            resume frame;
            expect(ok);
        }

        fn amain() !void {
            var download_frame = async fetchUrl(10, "a string");
            const download_text = try await download_frame;

            @panic("should not get here");
        }

        fn fetchUrl(unused: i32, url: []const u8) ![]u8 {
            frame = @frame();
            suspend;
            ok = true;
            return error.OutOfMemory;
        }
    };
    S.doTheTest();
}

test "async/await typical usage" {
    inline for ([_]bool{ false, true }) |b1| {
        inline for ([_]bool{ false, true }) |b2| {
            inline for ([_]bool{ false, true }) |b3| {
                inline for ([_]bool{ false, true }) |b4| {
                    testAsyncAwaitTypicalUsage(b1, b2, b3, b4).doTheTest();
                }
            }
        }
    }
}

fn testAsyncAwaitTypicalUsage(
    comptime simulate_fail_download: bool,
    comptime simulate_fail_file: bool,
    comptime suspend_download: bool,
    comptime suspend_file: bool,
) type {
    return struct {
        fn doTheTest() void {
            _ = async amainWrap();
            if (suspend_file) {
                resume global_file_frame;
            }
            if (suspend_download) {
                resume global_download_frame;
            }
        }
        fn amainWrap() void {
            if (amain()) |_| {
                expect(!simulate_fail_download);
                expect(!simulate_fail_file);
            } else |e| switch (e) {
                error.NoResponse => expect(simulate_fail_download),
                error.FileNotFound => expect(simulate_fail_file),
                else => @panic("test failure"),
            }
        }

        fn amain() !void {
            const allocator = std.heap.direct_allocator; // TODO once we have the debug allocator, use that, so that this can detect leaks
            var download_frame = async fetchUrl(allocator, "https://example.com/");
            var download_awaited = false;
            errdefer if (!download_awaited) {
                if (await download_frame) |x| allocator.free(x) else |_| {}
            };

            var file_frame = async readFile(allocator, "something.txt");
            var file_awaited = false;
            errdefer if (!file_awaited) {
                if (await file_frame) |x| allocator.free(x) else |_| {}
            };

            download_awaited = true;
            const download_text = try await download_frame;
            defer allocator.free(download_text);

            file_awaited = true;
            const file_text = try await file_frame;
            defer allocator.free(file_text);

            expect(std.mem.eql(u8, "expected download text", download_text));
            expect(std.mem.eql(u8, "expected file text", file_text));
        }

        var global_download_frame: anyframe = undefined;
        fn fetchUrl(allocator: *std.mem.Allocator, url: []const u8) anyerror![]u8 {
            const result = try std.mem.dupe(allocator, u8, "expected download text");
            errdefer allocator.free(result);
            if (suspend_download) {
                suspend {
                    global_download_frame = @frame();
                }
            }
            if (simulate_fail_download) return error.NoResponse;
            return result;
        }

        var global_file_frame: anyframe = undefined;
        fn readFile(allocator: *std.mem.Allocator, filename: []const u8) anyerror![]u8 {
            const result = try std.mem.dupe(allocator, u8, "expected file text");
            errdefer allocator.free(result);
            if (suspend_file) {
                suspend {
                    global_file_frame = @frame();
                }
            }
            if (simulate_fail_file) return error.FileNotFound;
            return result;
        }
    };
}

test "alignment of local variables in async functions" {
    const S = struct {
        fn doTheTest() void {
            var y: u8 = 123;
            var x: u8 align(128) = 1;
            expect(@ptrToInt(&x) % 128 == 0);
        }
    };
    S.doTheTest();
}

test "no reason to resolve frame still works" {
    _ = async simpleNothing();
}
fn simpleNothing() void {
    var x: i32 = 1234;
}

test "async call a generic function" {
    const S = struct {
        fn doTheTest() void {
            var f = async func(i32, 2);
            const result = await f;
            expect(result == 3);
        }

        fn func(comptime T: type, inc: T) T {
            var x: T = 1;
            suspend {
                resume @frame();
            }
            x += inc;
            return x;
        }
    };
    _ = async S.doTheTest();
}

test "return from suspend block" {
    const S = struct {
        fn doTheTest() void {
            expect(func() == 1234);
        }
        fn func() i32 {
            suspend {
                return 1234;
            }
        }
    };
    _ = async S.doTheTest();
}

test "struct parameter to async function is copied to the frame" {
    const S = struct {
        const Point = struct {
            x: i32,
            y: i32,
        };

        var frame: anyframe = undefined;

        fn doTheTest() void {
            _ = async atest();
            resume frame;
        }

        fn atest() void {
            var f: @Frame(foo) = undefined;
            bar(&f);
            clobberStack(10);
        }

        fn clobberStack(x: i32) void {
            if (x == 0) return;
            clobberStack(x - 1);
            var y: i32 = x;
        }

        fn bar(f: *@Frame(foo)) void {
            var pt = Point{ .x = 1, .y = 2 };
            f.* = async foo(pt);
            var result = await f;
            expect(result == 1);
        }

        fn foo(point: Point) i32 {
            suspend {
                frame = @frame();
            }
            return point.x;
        }
    };
    S.doTheTest();
}

test "cast fn to async fn when it is inferred to be async" {
    const S = struct {
        var frame: anyframe = undefined;
        var ok = false;

        fn doTheTest() void {
            var ptr: async fn () i32 = undefined;
            ptr = func;
            var buf: [100]u8 align(16) = undefined;
            var result: i32 = undefined;
            const f = @asyncCall(&buf, &result, ptr);
            _ = await f;
            expect(result == 1234);
            ok = true;
        }

        fn func() i32 {
            suspend {
                frame = @frame();
            }
            return 1234;
        }
    };
    _ = async S.doTheTest();
    resume S.frame;
    expect(S.ok);
}

test "cast fn to async fn when it is inferred to be async, awaited directly" {
    const S = struct {
        var frame: anyframe = undefined;
        var ok = false;

        fn doTheTest() void {
            var ptr: async fn () i32 = undefined;
            ptr = func;
            var buf: [100]u8 align(16) = undefined;
            var result: i32 = undefined;
            _ = await @asyncCall(&buf, &result, ptr);
            expect(result == 1234);
            ok = true;
        }

        fn func() i32 {
            suspend {
                frame = @frame();
            }
            return 1234;
        }
    };
    _ = async S.doTheTest();
    resume S.frame;
    expect(S.ok);
}

test "await does not force async if callee is blocking" {
    const S = struct {
        fn simple() i32 {
            return 1234;
        }
    };
    var x = async S.simple();
    expect(await x == 1234);
}

test "recursive async function" {
    expect(recursiveAsyncFunctionTest(false).doTheTest() == 55);
    expect(recursiveAsyncFunctionTest(true).doTheTest() == 55);
}

fn recursiveAsyncFunctionTest(comptime suspending_implementation: bool) type {
    return struct {
        fn fib(allocator: *std.mem.Allocator, x: u32) error{OutOfMemory}!u32 {
            if (x <= 1) return x;

            if (suspending_implementation) {
                suspend {
                    resume @frame();
                }
            }

            const f1 = try allocator.create(@Frame(fib));
            defer allocator.destroy(f1);

            const f2 = try allocator.create(@Frame(fib));
            defer allocator.destroy(f2);

            f1.* = async fib(allocator, x - 1);
            var f1_awaited = false;
            errdefer if (!f1_awaited) {
                _ = await f1;
            };

            f2.* = async fib(allocator, x - 2);
            var f2_awaited = false;
            errdefer if (!f2_awaited) {
                _ = await f2;
            };

            var sum: u32 = 0;

            f1_awaited = true;
            sum += try await f1;

            f2_awaited = true;
            sum += try await f2;

            return sum;
        }

        fn doTheTest() u32 {
            if (suspending_implementation) {
                var result: u32 = undefined;
                _ = async amain(&result);
                return result;
            } else {
                return fib(std.heap.direct_allocator, 10) catch unreachable;
            }
        }

        fn amain(result: *u32) void {
            var x = async fib(std.heap.direct_allocator, 10);
            result.* = (await x) catch unreachable;
        }
    };
}

test "@asyncCall with comptime-known function, but not awaited directly" {
    const S = struct {
        var global_frame: anyframe = undefined;

        fn doTheTest() void {
            var frame: [1]@Frame(middle) = undefined;
            var result: @typeOf(middle).ReturnType.ErrorSet!void = undefined;
            _ = @asyncCall(@sliceToBytes(frame[0..]), &result, middle);
            resume global_frame;
            std.testing.expectError(error.Fail, result);
        }

        async fn middle() !void {
            var f = async middle2();
            return await f;
        }

        fn middle2() !void {
            return failing();
        }

        fn failing() !void {
            global_frame = @frame();
            suspend;
            return error.Fail;
        }
    };
    S.doTheTest();
}

test "@asyncCall with actual frame instead of byte buffer" {
    const S = struct {
        fn func() i32 {
            suspend;
            return 1234;
        }
    };
    var frame: @Frame(S.func) = undefined;
    var result: i32 = undefined;
    const ptr = @asyncCall(&frame, &result, S.func);
    resume ptr;
    expect(result == 1234);
}

test "@asyncCall using the result location inside the frame" {
    const S = struct {
        async fn simple2(y: *i32) i32 {
            defer y.* += 2;
            y.* += 1;
            suspend;
            return 1234;
        }
        fn getAnswer(f: anyframe->i32, out: *i32) void {
            out.* = await f;
        }
    };
    var data: i32 = 1;
    const Foo = struct {
        bar: async fn (*i32) i32,
    };
    var foo = Foo{ .bar = S.simple2 };
    var bytes: [64]u8 align(16) = undefined;
    const f = @asyncCall(&bytes, {}, foo.bar, &data);
    comptime expect(@typeOf(f) == anyframe->i32);
    expect(data == 2);
    resume f;
    expect(data == 4);
    _ = async S.getAnswer(f, &data);
    expect(data == 1234);
}

test "@typeOf an async function call of generic fn with error union type" {
    const S = struct {
        fn func(comptime x: var) anyerror!i32 {
            const T = @typeOf(async func(x));
            comptime expect(T == @typeOf(@frame()).Child);
            return undefined;
        }
    };
    _ = async S.func(i32);
}

test "using @typeOf on a generic function call" {
    const S = struct {
        var global_frame: anyframe = undefined;
        var global_ok = false;

        var buf: [100]u8 align(16) = undefined;

        fn amain(x: var) void {
            if (x == 0) {
                global_ok = true;
                return;
            }
            suspend {
                global_frame = @frame();
            }
            const F = @typeOf(async amain(x - 1));
            const frame = @intToPtr(*F, @ptrToInt(&buf));
            return await @asyncCall(frame, {}, amain, x - 1);
        }
    };
    _ = async S.amain(u32(1));
    resume S.global_frame;
    expect(S.global_ok);
}

test "recursive call of await @asyncCall with struct return type" {
    const S = struct {
        var global_frame: anyframe = undefined;
        var global_ok = false;

        var buf: [100]u8 align(16) = undefined;

        fn amain(x: var) Foo {
            if (x == 0) {
                global_ok = true;
                return Foo{ .x = 1, .y = 2, .z = 3 };
            }
            suspend {
                global_frame = @frame();
            }
            const F = @typeOf(async amain(x - 1));
            const frame = @intToPtr(*F, @ptrToInt(&buf));
            return await @asyncCall(frame, {}, amain, x - 1);
        }

        const Foo = struct {
            x: u64,
            y: u64,
            z: u64,
        };
    };
    var res: S.Foo = undefined;
    var frame: @typeOf(async S.amain(u32(1))) = undefined;
    _ = @asyncCall(&frame, &res, S.amain, u32(1));
    resume S.global_frame;
    expect(S.global_ok);
    expect(res.x == 1);
    expect(res.y == 2);
    expect(res.z == 3);
}

test "noasync function call" {
    const S = struct {
        fn doTheTest() void {
            const result = noasync add(50, 100);
            expect(result == 150);
        }
        fn add(a: i32, b: i32) i32 {
            if (a > 100) {
                suspend;
            }
            return a + b;
        }
    };
    S.doTheTest();
}

test "await used in expression and awaiting fn with no suspend but async calling convention" {
    const S = struct {
        fn atest() void {
            var f1 = async add(1, 2);
            var f2 = async add(3, 4);

            const sum = (await f1) + (await f2);
            expect(sum == 10);
        }
        async fn add(a: i32, b: i32) i32 {
            return a + b;
        }
    };
    _ = async S.atest();
}

test "await used in expression after a fn call" {
    const S = struct {
        fn atest() void {
            var f1 = async add(3, 4);
            var sum: i32 = 0;
            sum = foo() + await f1;
            expect(sum == 8);
        }
        async fn add(a: i32, b: i32) i32 {
            return a + b;
        }
        fn foo() i32 { return 1; }
    };
    _ = async S.atest();
}

test "async fn call used in expression after a fn call" {
    const S = struct {
        fn atest() void {
            var sum: i32 = 0;
            sum = foo() + add(3, 4);
            expect(sum == 8);
        }
        async fn add(a: i32, b: i32) i32 {
            return a + b;
        }
        fn foo() i32 { return 1; }
    };
    _ = async S.atest();
}

test "suspend in for loop" {
    const S = struct {
        var global_frame: ?anyframe = null;

        fn doTheTest() void {
            _ = async atest();
            while (global_frame) |f| resume f;
        }

        fn atest() void {
            expect(func([_]u8{ 1, 2, 3 }) == 6);
        }
        fn func(stuff: []const u8) u32 {
            global_frame = @frame();
            var sum: u32 = 0;
            for (stuff) |x| {
                suspend;
                sum += x;
            }
            global_frame = null;
            return sum;
        }
    };
    S.doTheTest();
}

test "correctly spill when returning the error union result of another async fn" {
    const S = struct {
        var global_frame: anyframe = undefined;

        fn doTheTest() void {
            expect((atest() catch unreachable) == 1234);
        }

        fn atest() !i32 {
            return fallible1();
        }

        fn fallible1() anyerror!i32 {
            suspend {
                global_frame = @frame();
            }
            return 1234;
        }
    };
    _ = async S.doTheTest();
    resume S.global_frame;
}


test "spill target expr in a for loop" {
    const S = struct {
        var global_frame: anyframe = undefined;

        fn doTheTest() void {
            var foo = Foo{
                .slice = [_]i32{1, 2},
            };
            expect(atest(&foo) == 3);
        }

        const Foo = struct {
            slice: []i32,
        };

        fn atest(foo: *Foo) i32 {
            var sum: i32 = 0;
            for (foo.slice) |x| {
                suspend {
                    global_frame = @frame();
                }
                sum += x;
            }
            return sum;
        }
    };
    _ = async S.doTheTest();
    resume S.global_frame;
    resume S.global_frame;
}

test "spill target expr in a for loop, with a var decl in the loop body" {
    const S = struct {
        var global_frame: anyframe = undefined;

        fn doTheTest() void {
            var foo = Foo{
                .slice = [_]i32{1, 2},
            };
            expect(atest(&foo) == 3);
        }

        const Foo = struct {
            slice: []i32,
        };

        fn atest(foo: *Foo) i32 {
            var sum: i32 = 0;
            for (foo.slice) |x| {
                // Previously this var decl would prevent spills. This test makes sure
                // the for loop spills still happen even though there is a VarDecl in scope
                // before the suspend.
                var anything = true;
                _ = anything;
                suspend {
                    global_frame = @frame();
                }
                sum += x;
            }
            return sum;
        }
    };
    _ = async S.doTheTest();
    resume S.global_frame;
    resume S.global_frame;
}
