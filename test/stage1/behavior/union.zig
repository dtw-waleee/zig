const std = @import("std");
const expect = std.testing.expect;

const Value = union(enum) {
    Int: u64,
    Array: [9]u8,
};

const Agg = struct {
    val1: Value,
    val2: Value,
};

const v1 = Value{ .Int = 1234 };
const v2 = Value{ .Array = [_]u8{3} ** 9 };

const err = (anyerror!Agg)(Agg{
    .val1 = v1,
    .val2 = v2,
});

const array = [_]Value{
    v1,
    v2,
    v1,
    v2,
};

test "unions embedded in aggregate types" {
    switch (array[1]) {
        Value.Array => |arr| expect(arr[4] == 3),
        else => unreachable,
    }
    switch ((err catch unreachable).val1) {
        Value.Int => |x| expect(x == 1234),
        else => unreachable,
    }
}

const Foo = union {
    float: f64,
    int: i32,
};

test "basic unions" {
    var foo = Foo{ .int = 1 };
    expect(foo.int == 1);
    foo = Foo{ .float = 12.34 };
    expect(foo.float == 12.34);
}

test "comptime union field access" {
    comptime {
        var foo = Foo{ .int = 0 };
        expect(foo.int == 0);

        foo = Foo{ .float = 42.42 };
        expect(foo.float == 42.42);
    }
}

test "init union with runtime value" {
    var foo: Foo = undefined;

    setFloat(&foo, 12.34);
    expect(foo.float == 12.34);

    setInt(&foo, 42);
    expect(foo.int == 42);
}

fn setFloat(foo: *Foo, x: f64) void {
    foo.* = Foo{ .float = x };
}

fn setInt(foo: *Foo, x: i32) void {
    foo.* = Foo{ .int = x };
}

const FooExtern = extern union {
    float: f64,
    int: i32,
};

test "basic extern unions" {
    var foo = FooExtern{ .int = 1 };
    expect(foo.int == 1);
    foo.float = 12.34;
    expect(foo.float == 12.34);
}

const Letter = enum {
    A,
    B,
    C,
};
const Payload = union(Letter) {
    A: i32,
    B: f64,
    C: bool,
};

test "union with specified enum tag" {
    doTest();
    comptime doTest();
}

fn doTest() void {
    expect(bar(Payload{ .A = 1234 }) == -10);
}

fn bar(value: Payload) i32 {
    expect(Letter(value) == Letter.A);
    return switch (value) {
        Payload.A => |x| return x - 1244,
        Payload.B => |x| if (x == 12.34) i32(20) else 21,
        Payload.C => |x| if (x) i32(30) else 31,
    };
}

const MultipleChoice = union(enum(u32)) {
    A = 20,
    B = 40,
    C = 60,
    D = 1000,
};
test "simple union(enum(u32))" {
    var x = MultipleChoice.C;
    expect(x == MultipleChoice.C);
    expect(@enumToInt(@TagType(MultipleChoice)(x)) == 60);
}

const MultipleChoice2 = union(enum(u32)) {
    Unspecified1: i32,
    A: f32 = 20,
    Unspecified2: void,
    B: bool = 40,
    Unspecified3: i32,
    C: i8 = 60,
    Unspecified4: void,
    D: void = 1000,
    Unspecified5: i32,
};

test "union(enum(u32)) with specified and unspecified tag values" {
    comptime expect(@TagType(@TagType(MultipleChoice2)) == u32);
    testEnumWithSpecifiedAndUnspecifiedTagValues(MultipleChoice2{ .C = 123 });
    comptime testEnumWithSpecifiedAndUnspecifiedTagValues(MultipleChoice2{ .C = 123 });
}

fn testEnumWithSpecifiedAndUnspecifiedTagValues(x: MultipleChoice2) void {
    expect(@enumToInt(@TagType(MultipleChoice2)(x)) == 60);
    expect(1123 == switch (x) {
        MultipleChoice2.A => 1,
        MultipleChoice2.B => 2,
        MultipleChoice2.C => |v| i32(1000) + v,
        MultipleChoice2.D => 4,
        MultipleChoice2.Unspecified1 => 5,
        MultipleChoice2.Unspecified2 => 6,
        MultipleChoice2.Unspecified3 => 7,
        MultipleChoice2.Unspecified4 => 8,
        MultipleChoice2.Unspecified5 => 9,
    });
}

const ExternPtrOrInt = extern union {
    ptr: *u8,
    int: u64,
};
test "extern union size" {
    comptime expect(@sizeOf(ExternPtrOrInt) == 8);
}

const PackedPtrOrInt = packed union {
    ptr: *u8,
    int: u64,
};
test "extern union size" {
    comptime expect(@sizeOf(PackedPtrOrInt) == 8);
}

const ZeroBits = union {
    OnlyField: void,
};
test "union with only 1 field which is void should be zero bits" {
    comptime expect(@sizeOf(ZeroBits) == 0);
}

const TheTag = enum {
    A,
    B,
    C,
};
const TheUnion = union(TheTag) {
    A: i32,
    B: i32,
    C: i32,
};
test "union field access gives the enum values" {
    expect(TheUnion.A == TheTag.A);
    expect(TheUnion.B == TheTag.B);
    expect(TheUnion.C == TheTag.C);
}

test "cast union to tag type of union" {
    testCastUnionToTagType(TheUnion{ .B = 1234 });
    comptime testCastUnionToTagType(TheUnion{ .B = 1234 });
}

fn testCastUnionToTagType(x: TheUnion) void {
    expect(TheTag(x) == TheTag.B);
}

test "cast tag type of union to union" {
    var x: Value2 = Letter2.B;
    expect(Letter2(x) == Letter2.B);
}
const Letter2 = enum {
    A,
    B,
    C,
};
const Value2 = union(Letter2) {
    A: i32,
    B,
    C,
};

test "implicit cast union to its tag type" {
    var x: Value2 = Letter2.B;
    expect(x == Letter2.B);
    giveMeLetterB(x);
}
fn giveMeLetterB(x: Letter2) void {
    expect(x == Value2.B);
}

pub const PackThis = union(enum) {
    Invalid: bool,
    StringLiteral: u2,
};

test "constant packed union" {
    testConstPackedUnion([_]PackThis{PackThis{ .StringLiteral = 1 }});
}

fn testConstPackedUnion(expected_tokens: []const PackThis) void {
    expect(expected_tokens[0].StringLiteral == 1);
}

test "switch on union with only 1 field" {
    var r: PartialInst = undefined;
    r = PartialInst.Compiled;
    switch (r) {
        PartialInst.Compiled => {
            var z: PartialInstWithPayload = undefined;
            z = PartialInstWithPayload{ .Compiled = 1234 };
            switch (z) {
                PartialInstWithPayload.Compiled => |x| {
                    expect(x == 1234);
                    return;
                },
            }
        },
    }
    unreachable;
}

const PartialInst = union(enum) {
    Compiled,
};

const PartialInstWithPayload = union(enum) {
    Compiled: i32,
};

test "access a member of tagged union with conflicting enum tag name" {
    const Bar = union(enum) {
        A: A,
        B: B,

        const A = u8;
        const B = void;
    };

    comptime expect(Bar.A == u8);
}

test "tagged union initialization with runtime void" {
    expect(testTaggedUnionInit({}));
}

const TaggedUnionWithAVoid = union(enum) {
    A,
    B: i32,
};

fn testTaggedUnionInit(x: var) bool {
    const y = TaggedUnionWithAVoid{ .A = x };
    return @TagType(TaggedUnionWithAVoid)(y) == TaggedUnionWithAVoid.A;
}

pub const UnionEnumNoPayloads = union(enum) {
    A,
    B,
};

test "tagged union with no payloads" {
    const a = UnionEnumNoPayloads{ .B = {} };
    switch (a) {
        @TagType(UnionEnumNoPayloads).A => @panic("wrong"),
        @TagType(UnionEnumNoPayloads).B => {},
    }
}

test "union with only 1 field casted to its enum type" {
    const Literal = union(enum) {
        Number: f64,
        Bool: bool,
    };

    const Expr = union(enum) {
        Literal: Literal,
    };

    var e = Expr{ .Literal = Literal{ .Bool = true } };
    const Tag = @TagType(Expr);
    comptime expect(@TagType(Tag) == u0);
    var t = Tag(e);
    expect(t == Expr.Literal);
}

test "union with only 1 field casted to its enum type which has enum value specified" {
    const Literal = union(enum) {
        Number: f64,
        Bool: bool,
    };

    const Tag = enum(comptime_int) {
        Literal = 33,
    };

    const Expr = union(Tag) {
        Literal: Literal,
    };

    var e = Expr{ .Literal = Literal{ .Bool = true } };
    comptime expect(@TagType(Tag) == comptime_int);
    var t = Tag(e);
    expect(t == Expr.Literal);
    expect(@enumToInt(t) == 33);
    comptime expect(@enumToInt(t) == 33);
}

test "@enumToInt works on unions" {
    const Bar = union(enum) {
        A: bool,
        B: u8,
        C,
    };

    const a = Bar{ .A = true };
    var b = Bar{ .B = undefined };
    var c = Bar.C;
    expect(@enumToInt(a) == 0);
    expect(@enumToInt(b) == 1);
    expect(@enumToInt(c) == 2);
}

const Attribute = union(enum) {
    A: bool,
    B: u8,
};

fn setAttribute(attr: Attribute) void {}

fn Setter(attr: Attribute) type {
    return struct {
        fn set() void {
            setAttribute(attr);
        }
    };
}

test "comptime union field value equality" {
    const a0 = Setter(Attribute{ .A = false });
    const a1 = Setter(Attribute{ .A = true });
    const a2 = Setter(Attribute{ .A = false });

    const b0 = Setter(Attribute{ .B = 5 });
    const b1 = Setter(Attribute{ .B = 9 });
    const b2 = Setter(Attribute{ .B = 5 });

    expect(a0 == a0);
    expect(a1 == a1);
    expect(a0 == a2);

    expect(b0 == b0);
    expect(b1 == b1);
    expect(b0 == b2);

    expect(a0 != b0);
    expect(a0 != a1);
    expect(b0 != b1);
}

test "return union init with void payload" {
    const S = struct {
        fn entry() void {
            expect(func().state == State.one);
        }
        const Outer = union(enum) {
            state: State,
        };
        const State = union(enum) {
            one: void,
            two: u32,
        };
        fn func() Outer {
            return Outer{ .state = State{ .one = {} } };
        }
    };
    S.entry();
    comptime S.entry();
}

test "@unionInit can modify a union type" {
    const UnionInitEnum = union(enum) {
        Boolean: bool,
        Byte: u8,
    };

    var value: UnionInitEnum = undefined;

    value = @unionInit(UnionInitEnum, "Boolean", true);
    expect(value.Boolean == true);
    value.Boolean = false;
    expect(value.Boolean == false);

    value = @unionInit(UnionInitEnum, "Byte", 2);
    expect(value.Byte == 2);
    value.Byte = 3;
    expect(value.Byte == 3);
}

test "@unionInit can modify a pointer value" {
    const UnionInitEnum = union(enum) {
        Boolean: bool,
        Byte: u8,
    };

    var value: UnionInitEnum = undefined;
    var value_ptr = &value;

    value_ptr.* = @unionInit(UnionInitEnum, "Boolean", true);
    expect(value.Boolean == true);

    value_ptr.* = @unionInit(UnionInitEnum, "Byte", 2);
    expect(value.Byte == 2);
}

test "union no tag with struct member" {
    const Struct = struct {};
    const Union = union {
        s: Struct,
        pub fn foo(self: *@This()) void {}
    };
    var u = Union{ .s = Struct{} };
    u.foo();
}

fn testComparison() void {
    var x = Payload{ .A = 42 };
    expect(x == .A);
    expect(x != .B);
    expect(x != .C);
    expect((x == .B) == false);
    expect((x == .C) == false);
    expect((x != .A) == false);
}

test "comparison between union and enum literal" {
    testComparison();
    comptime testComparison();
}

test "packed union generates correctly aligned LLVM type" {
    const U = packed union {
        f1: fn () void,
        f2: u32,
    };
    var foo = [_]U{
        U{ .f1 = doTest },
        U{ .f2 = 0 },
    };
    foo[0].f1();
}

test "union with one member defaults to u0 tag type" {
    const U0 = union(enum) {
        X: u32,
    };
    comptime expect(@TagType(@TagType(U0)) == u0);
}

test "union with comptime_int tag" {
    const Union = union(enum(comptime_int)) {
        X: u32,
        Y: u16,
        Z: u8,
    };
    comptime expect(@TagType(@TagType(Union)) == comptime_int);
}

test "extern union doesn't trigger field check at comptime" {
    const U = extern union {
        x: u32,
        y: u8,
    };

    const x = U{ .x = 0x55AAAA55 };
    comptime expect(x.y == 0x55);
}
