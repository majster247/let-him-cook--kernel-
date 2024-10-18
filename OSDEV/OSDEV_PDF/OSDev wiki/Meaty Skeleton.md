
# Meaty Skeleton - OSDev Wiki

| Difficulty level |
| ---------------- |
| #Beginner        |

* Kernel Designs: Models
* Kernel Designs: Monolithic KernelMicrokernelHybrid KernelExokernelNano/PicokernelCache KernelVirtualizing KernelMegalithic Kernel
* Kernel Designs: Other Concepts
* Kernel Designs: Modular KernelHigher Half Kernel64-bit Kernel


This tutorial continues from [Bare Bones](https://wiki.osdev.org/Bare_Bones "Bare Bones") and creates a minimal template operating system in the [Stan Dard](https://wiki.osdev.org/Stan_Dard "Stan Dard") style suitable for further modification or as inspiration for your initial operating system version. The [Bare Bones](https://wiki.osdev.org/Bare_Bones "Bare Bones") tutorial only gives you the absolutely minimal code to demonstrate how to correctly cross-compile a kernel, however this is unsuitable as an example operating system. Additionally, this tutorial implements neccesary ABI features needed to satisfy the ABI and compiler contracts to prevent possible mysterious errors.

This tutorial also serves as the initial template tutorial on how to [create your own libc](https://wiki.osdev.org/Creating_a_C_Library "Creating a C Library") (Standard C Library). The GCC documentation explicitly states that libgcc requires the freestanding environment to supply the memcmp, memcpy, memmove, and memset functions, as well as abort on some platforms. We will satisfy this requirement by creating a special kernel C library (libk) that contains the parts of the user-space libc that are _freestanding_ (doesn't require any kernel features) as opposed to _hosted_ libc features that need to do system calls.

Preface
-------

This tutorial is an example on how you could structure your operating system in a manner that will continue to serve you well for the foreseeable future. This serves as both inspiration and as an example for those that wish to something different, while as a base for the rest. The tutorial does embed a few important concepts into your operating system such as the existence of a libc, as well as indirectly other minor Unix and ABI semantics. Adapt what you wish from this tutorial. Note that the shell script and Make-based build system constructed in this tutorial is meant for Unix systems. There is no pressing need to make this portable across all operating systems as this is just an example.

We will name this new example operating system myos. This is just a placeholder and you should replace all occurrences of myos with what you decide to call your operating system.

Bare Bones
----------

_Main article:_ [Bare Bones](https://wiki.osdev.org/Bare_Bones "Bare Bones")

You are expected to have completed the [Bare Bones](https://wiki.osdev.org/Bare_Bones "Bare Bones") tutorial before continuing to this tutorial. It is not strictly neccesary to have completed [Bare Bones](https://wiki.osdev.org/Bare_Bones "Bare Bones"), but doing so confirms that your development environment works as well as explaining a number of core things.

You should probably discard the code you got from toying around with [Bare Bones](https://wiki.osdev.org/Bare_Bones "Bare Bones") and start over with this tutorial as your basis.

Building a Cross-Compiler
-------------------------

_Main article: [GCC Cross-Compiler](https://wiki.osdev.org/GCC_Cross-Compiler "GCC Cross-Compiler"), [Why do I need a Cross Compiler?](https://wiki.osdev.org/Why_do_I_need_a_Cross_Compiler%3F "Why do I need a Cross Compiler?")_

You _must_ use a [GCC Cross-Compiler](https://wiki.osdev.org/GCC_Cross-Compiler "GCC Cross-Compiler") in this tutorial as in the [Bare Bones](https://wiki.osdev.org/Bare_Bones "Bare Bones") tutorial. You should use the **i686-elf** target in your cross-compiler, though any ix86-elf target (but no less than i386) will do fine for our purposes here.

You _must_ configure your cross-binutils with the \--with-sysroot option, otherwise linking will mysteriously fail with the _this linker was not configured to use sysroots_ error message. If you forgot to configure your cross-binutils with that option, you'll have to rebuild it, but you can keep your cross-gcc.

Dependencies
------------

You will need these dependencies in order to complete this tutorial:

*   i686-elf toolchain, as discussed above.
*   GRUB, for the grub-mkrescue command, along with the appropriate runtime files.
*   Xorriso, the .iso creation engine used by grub-mkrescue.
*   GNU make 4.0 or later.
*   Qemu, optionally for testing the operating system.

This tutorial requires a GNU/Linux system, or a similar enough system. The BSD systems may almost work. OS X is not supported but can possibly be made to work with some changes. Windows is not supported, but Windows environments like Cygwin and Windows Subsystem For Linux (WSL) might work.

### Debian-family Users

Install the i686-elf toolchain as described above and then install the packages xorriso grub-pc-bin.

System Root
-----------

Normally when you compile programs for your local operating system, the compiler locates development files such as headers and libraries in system directories such as:

/usr/include

/usr/lib

These files are of course not usable for your operating system. Instead you want to have your own version of these directories that contains files for your operating system:

/home/bwayne/myos/sysroot/usr/include

/home/bwayne/myos/sysroot/usr/lib

The /home/bwayne/myos/sysroot directory acts as a fake root directory for your operating system. This is called a system root, or _sysroot_.

You can think of the sysroot as the root directory for your operating system. Your build process will build each component of your operating system (kernel, standard library, programs) and gradually install them into the system root. Ultimately the system root will be a fully functional root filesystem for your operating system, you format a partition and copy the files there, add the appropriate configuration files, configure a bootloader to load the kernel from there, and use your harddisk driver and filesystem driver to read the files from there. The system root is thus a temporary directory that will ultimately become the actual root directory of your operating system.

In this example the cross system root is located as sysroot/, which is a directory created by the build scripts and populated by the make install targets. The makefiles will install the system headers into the sysroot/usr/include directory, the system libraries into the sysroot/usr/lib directory and the kernel itself into the sysroot/boot directory.

We already use system roots because it will make it smoother to add a user-space when you get that far. This scheme is very convenient when you later [Port Third-Party Software by Cross-Compiling It](https://wiki.osdev.org/Cross-Porting_Software "Cross-Porting Software").

The \-elf targets have no user-space and are incapable of having one. We configured the compiler with system root support, so it will look in ${SYSROOT}/usr/lib as expected. We prevented the compiler from searching for a standard library using the --without-headers option when building i686-elf-gcc, so it will _not_ look in ${SYSROOT}/usr/include. (Once you add a user-space and a libc, you will configure your custom cross-gcc with \--with-sysroot and it will look in ${SYSROOT}/usr/include. As a temporary work-around until you get that far, we fix it by passing \-isystem=/usr/include).

You can change the system root directory layout if you wish, but you will have to modify some Binutils and GCC source code and tell them [what your operating system is](https://wiki.osdev.org/OS_Specific_Toolchain "OS Specific Toolchain"). This is advanced and not worth doing until you add a proper user-space. Note that the cross-linker currently looks in /lib, /usr/lib and /usr/local/lib by default, so you can move files there without changing Binutils. Also note that we use the \-isystem option for GCC (as it was configured without a system include directory), so you can move that around freely.

The ./headers.sh script simply installs the headers for your libc and kernel (system headers) into sysroot/usr/include, but doesn't actually cross-compile your operating system. This is useful as it allows you to provide the compiler a copy of your headers before you actually compile your system. You will [need to provide the standard library headers](https://wiki.osdev.org/Hosted_GCC_Cross-Compiler#Sysroot_Headers "Hosted GCC Cross-Compiler") when you build a [Hosted GCC Cross-Compiler](https://wiki.osdev.org/Hosted_GCC_Cross-Compiler "Hosted GCC Cross-Compiler") in the future that is capable of an user-space.

Note how your cross-compiler comes with a number of fully freestanding headers such as stddef.h and stdint.h. These headers simply declare types and macros that are useful. Your kernel standard library will supply a number of useful functions (such as strlen) that doesn't require system calls and are freestanding except they need an implementation somewhere.

Makefile Design
---------------

The makefiles in this example respect the environment variables (such as CFLAGS that tell what default compile options are used to compile C programs). This lets the user control stuff such as which optimization levels are used, while a default is used if the user has no opinion. The makefiles also make sure that particular options are always in CFLAGS. This is done by having two phases in the makefiles: one that sets a default value and one that adds mandatory options the project makefile requires:

```
# Default CFLAGS:
CFLAGS?=-O2 -g

# Add mandatory options to CFLAGS:
CFLAGS:=$(CFLAGS) -Wall -Wextra

```


Architecture Directories
------------------------

The projects in this example (libc and kernel) store all the architecture dependent source files inside an arch/ directory with their own sub-makefile that has special configuration. This cleanly separates the systems you support and will make it easier to port to other systems in the future.

Kernel Design
-------------

We have moved the kernel into its own directory named kernel/. It would perhaps be better to call it something else if your kernel has another name than your full operating system distribution, though calling it kernel/ makes it easier for other hobbyist developers to find the core parts of your new operating system.

The kernel installs its public kernel headers into sysroot/usr/include/kernel. This is useful if you decide to create a kernel with modules, where modules can then simply include the public headers from the main kernel.

GNU GRUB is used as the bootloader and the kernel uses Multiboot as in the [Bare Bones](https://wiki.osdev.org/Bare_Bones "Bare Bones") tutorial.

The kernel implements the correct way of [invoking global constructors](https://wiki.osdev.org/Calling_Global_Constructors "Calling Global Constructors") (useful for C++ code and C code using \_\_attribute\_\_((constructor)). The bootstrap assembly calls \_init which invokes all the global constructors. These are invoked very early in the boot without any specific ordering. You should only use them to initialize global variables that could not be initialized at runtime.

The special \_\_is\_kernel macro lets the source code detect whether it is part of the kernel.

libc and libk Design
--------------------

The libc and libk are actually two versions of the same library, which is stored in the directory libc/. The standard library is split into two versions: freestanding and hosted. The difference is that the freestanding library (libk) doesn't contain any of the code that only works in user-space, such as system calls. The libk is also built with different compiler options, just like the kernel isn't built like normal user-space code.

You are not required to have a libk. You could just as easily have a regular libc and a fully seperate minimal project inside the kernel directory. The libk scheme avoids code duplication, so you don't have to maintain multiple versions of strlen and such.

This example doesn't come with a usable libc. It compiles a libc.a that is entirely useless, except being a skeleton we can build on when we add user-space in a later tutorial.

Each standard function is put inside a file with the same name as the function inside a directory with the name of the header. For instance, strlen from string.h is in libc/string/strlen.c and stat from sys/stat.h would be in libc/sys/stat/stat.c.

The standard headers use a BSD-like scheme where sys/cdefs.h declares a bunch of useful preprocessor macros meant for internal use by the standard library. All the function prototypes are wrapped in extern "C" { and } such that C++ code can correctly link against libc (as libc doesn't use C++ linkage). Note also how the compiler provides the internal keyword \_\_restrict unconditionally (even in C89) mode, which is useful for adding the restrict keyword to function prototypes even when compiling code in pre-C99 or C++ mode.

The special \_\_is\_libc macro lets the source code detect whether it is part of the libc and \_\_is\_libk lets the source code detect whether it's part of the libk binary.

This example comes with a small number of standard functions that serve as examples and serve to satisfy ABI requirements. Note that the printf function included is very minimal and intentionally doesn't handle most common features.

Source Code
-----------

You can easily download the source code using [Git](https://wiki.osdev.org/Git "Git") from the [Meaty Skeleton Git repository](https://gitlab.com/sortie/meaty-skeleton). This is preferable to doing a manual error-prone copy, as you may make a mistake or whitespace may get garbled due to bugs in our syntax highlighting. To clone the git repository, do:

```
git clone https://gitlab.com/sortie/meaty-skeleton.git

```


Check for differences between the git revision used in this article and what you cloned (empty output means there is no difference):

```
git diff 084d1624bedaa9f9e395f055c6bd99299bd97f58..master

```


Operating systems development is about being an expert. Take the time to read the code carefully through and understand it. Please seek further information and help if you don't understand aspects of it. This code is minimal and almost everything is done deliberately, often to pre-emptively solve future problems.

### kernel

#### kernel/include/kernel/tty.h

```
#ifndef _KERNEL_TTY_H
#define _KERNEL_TTY_H

#include <stddef.h>

void terminal_initialize(void);
void terminal_putchar(char c);
void terminal_write(const char* data, size_t size);
void terminal_writestring(const char* data);

#endif

```


#### kernel/Makefile

```
DEFAULT_HOST!=../default-host.sh
HOST?=DEFAULT_HOST
HOSTARCH!=../target-triplet-to-arch.sh $(HOST)

CFLAGS?=-O2 -g
CPPFLAGS?=
LDFLAGS?=
LIBS?=

DESTDIR?=
PREFIX?=/usr/local
EXEC_PREFIX?=$(PREFIX)
BOOTDIR?=$(EXEC_PREFIX)/boot
INCLUDEDIR?=$(PREFIX)/include

CFLAGS:=$(CFLAGS) -ffreestanding -Wall -Wextra
CPPFLAGS:=$(CPPFLAGS) -D__is_kernel -Iinclude
LDFLAGS:=$(LDFLAGS)
LIBS:=$(LIBS) -nostdlib -lk -lgcc

ARCHDIR=arch/$(HOSTARCH)

include $(ARCHDIR)/make.config

CFLAGS:=$(CFLAGS) $(KERNEL_ARCH_CFLAGS)
CPPFLAGS:=$(CPPFLAGS) $(KERNEL_ARCH_CPPFLAGS)
LDFLAGS:=$(LDFLAGS) $(KERNEL_ARCH_LDFLAGS)
LIBS:=$(LIBS) $(KERNEL_ARCH_LIBS)

KERNEL_OBJS=\
$(KERNEL_ARCH_OBJS) \
kernel/kernel.o \

OBJS=\
$(ARCHDIR)/crti.o \
$(ARCHDIR)/crtbegin.o \
$(KERNEL_OBJS) \
$(ARCHDIR)/crtend.o \
$(ARCHDIR)/crtn.o \

LINK_LIST=\
$(LDFLAGS) \
$(ARCHDIR)/crti.o \
$(ARCHDIR)/crtbegin.o \
$(KERNEL_OBJS) \
$(LIBS) \
$(ARCHDIR)/crtend.o \
$(ARCHDIR)/crtn.o \

.PHONY: all clean install install-headers install-kernel
.SUFFIXES: .o .c .S

all: myos.kernel

myos.kernel: $(OBJS) $(ARCHDIR)/linker.ld
	$(CC) -T $(ARCHDIR)/linker.ld -o $@ $(CFLAGS) $(LINK_LIST)
	grub-file --is-x86-multiboot myos.kernel

$(ARCHDIR)/crtbegin.o $(ARCHDIR)/crtend.o:
	OBJ=`$(CC) $(CFLAGS) $(LDFLAGS) -print-file-name=$(@F)` && cp "$OBJ" $@

.c.o:
	$(CC) -MD -c $< -o $@ -std=gnu11 $(CFLAGS) $(CPPFLAGS)

.S.o:
	$(CC) -MD -c $< -o $@ $(CFLAGS) $(CPPFLAGS)

clean:
	rm -f myos.kernel
	rm -f $(OBJS) *.o */*.o */*/*.o
	rm -f $(OBJS:.o=.d) *.d */*.d */*/*.d

install: install-headers install-kernel

install-headers:
	mkdir -p $(DESTDIR)$(INCLUDEDIR)
	cp -R --preserve=timestamps include/. $(DESTDIR)$(INCLUDEDIR)/.

install-kernel: myos.kernel
	mkdir -p $(DESTDIR)$(BOOTDIR)
	cp myos.kernel $(DESTDIR)$(BOOTDIR)

-include $(OBJS:.o=.d)

```


#### kernel/kernel/kernel.c

```
#include <stdio.h>

#include <kernel/tty.h>

void kernel_main(void) {
	terminal_initialize();
	printf("Hello, kernel World!\n");
}

```


#### kernel/arch/i386/tty.c

```
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>

#include <kernel/tty.h>

#include "vga.h"

static const size_t VGA_WIDTH = 80;
static const size_t VGA_HEIGHT = 25;
static uint16_t* const VGA_MEMORY = (uint16_t*) 0xB8000;

static size_t terminal_row;
static size_t terminal_column;
static uint8_t terminal_color;
static uint16_t* terminal_buffer;

void terminal_initialize(void) {
	terminal_row = 0;
	terminal_column = 0;
	terminal_color = vga_entry_color(VGA_COLOR_LIGHT_GREY, VGA_COLOR_BLACK);
	terminal_buffer = VGA_MEMORY;
	for (size_t y = 0; y < VGA_HEIGHT; y++) {
		for (size_t x = 0; x < VGA_WIDTH; x++) {
			const size_t index = y * VGA_WIDTH + x;
			terminal_buffer[index] = vga_entry(' ', terminal_color);
		}
	}
}

void terminal_setcolor(uint8_t color) {
	terminal_color = color;
}

void terminal_putentryat(unsigned char c, uint8_t color, size_t x, size_t y) {
	const size_t index = y * VGA_WIDTH + x;
	terminal_buffer[index] = vga_entry(c, color);
}

void terminal_scroll(int line) {
	int loop;
	char c;

	for(loop = line * (VGA_WIDTH * 2) + 0xB8000; loop < VGA_WIDTH * 2; loop++) {
		c = *loop;
		*(loop - (VGA_WIDTH * 2)) = c;
	}
}

void terminal_delete_last_line() {
	int x, *ptr;

	for(x = 0; x < VGA_WIDTH * 2; x++) {
		ptr = 0xB8000 + (VGA_WIDTH * 2) * (VGA_HEIGHT - 1) + x;
		*ptr = 0;
	}
}

void terminal_putchar(char c) {
	int line;
	unsigned char uc = c;

	terminal_putentryat(uc, terminal_color, terminal_column, terminal_row);
	if (++terminal_column == VGA_WIDTH) {
		terminal_column = 0;
		if (++terminal_row == VGA_HEIGHT)
		{
			for(line = 1; line <= VGA_HEIGHT - 1; line++)
			{
				terminal_scroll(line);
			}
			terminal_delete_last_line();
			terminal_row = VGA_HEIGHT - 1;
		}
	}
}

void terminal_write(const char* data, size_t size) {
	for (size_t i = 0; i < size; i++)
		terminal_putchar(data[i]);
}

void terminal_writestring(const char* data) {
	terminal_write(data, strlen(data));
}

```


#### kernel/arch/i386/crtn.S

```
.section .init
	/* gcc will nicely put the contents of crtend.o's .init section here. */
	popl %ebp
	ret

.section .fini
	/* gcc will nicely put the contents of crtend.o's .fini section here. */
	popl %ebp
	ret

```


#### kernel/arch/i386/vga.h

```
#ifndef ARCH_I386_VGA_H
#define ARCH_I386_VGA_H

#include <stdint.h>

enum vga_color {
	VGA_COLOR_BLACK = 0,
	VGA_COLOR_BLUE = 1,
	VGA_COLOR_GREEN = 2,
	VGA_COLOR_CYAN = 3,
	VGA_COLOR_RED = 4,
	VGA_COLOR_MAGENTA = 5,
	VGA_COLOR_BROWN = 6,
	VGA_COLOR_LIGHT_GREY = 7,
	VGA_COLOR_DARK_GREY = 8,
	VGA_COLOR_LIGHT_BLUE = 9,
	VGA_COLOR_LIGHT_GREEN = 10,
	VGA_COLOR_LIGHT_CYAN = 11,
	VGA_COLOR_LIGHT_RED = 12,
	VGA_COLOR_LIGHT_MAGENTA = 13,
	VGA_COLOR_LIGHT_BROWN = 14,
	VGA_COLOR_WHITE = 15,
};

static inline uint8_t vga_entry_color(enum vga_color fg, enum vga_color bg) {
	return fg | bg << 4;
}

static inline uint16_t vga_entry(unsigned char uc, uint8_t color) {
	return (uint16_t) uc | (uint16_t) color << 8;
}

#endif

```


#### kernel/arch/i386/make.config

```
KERNEL_ARCH_CFLAGS=
KERNEL_ARCH_CPPFLAGS=
KERNEL_ARCH_LDFLAGS=
KERNEL_ARCH_LIBS=

KERNEL_ARCH_OBJS=\
$(ARCHDIR)/boot.o \
$(ARCHDIR)/tty.o \

```


#### kernel/arch/i386/crti.S

```
.section .init
.global _init
.type _init, @function
_init:
	push %ebp
	movl %esp, %ebp
	/* gcc will nicely put the contents of crtbegin.o's .init section here. */

.section .fini
.global _fini
.type _fini, @function
_fini:
	push %ebp
	movl %esp, %ebp
	/* gcc will nicely put the contents of crtbegin.o's .fini section here. */

```


#### kernel/arch/i386/linker.ld

```
/* The bootloader will look at this image and start execution at the symbol
   designated at the entry point. */
ENTRY(_start)

/* Tell where the various sections of the object files will be put in the final
   kernel image. */
SECTIONS
{
	/* Begin putting sections at 1 MiB, a conventional place for kernels to be
	   loaded at by the bootloader. */
	. = 1M;

	/* First put the multiboot header, as it is required to be put very early
	   early in the image or the bootloader won't recognize the file format.
	   Next we'll put the .text section. */
	.text BLOCK(4K) : ALIGN(4K)
	{
		*(.multiboot)
		*(.text)
	}

	/* Read-only data. */
	.rodata BLOCK(4K) : ALIGN(4K)
	{
		*(.rodata)
	}

	/* Read-write data (initialized) */
	.data BLOCK(4K) : ALIGN(4K)
	{
		*(.data)
	}

	/* Read-write data (uninitialized) and stack */
	.bss BLOCK(4K) : ALIGN(4K)
	{
		*(COMMON)
		*(.bss)
	}

	/* The compiler may produce other sections, put them in the proper place in
	   in this file, if you'd like to include them in the final kernel. */
}

```


#### kernel/arch/i386/boot.S

```
# Declare constants for the multiboot header.
.set ALIGN,    1<<0             # align loaded modules on page boundaries
.set MEMINFO,  1<<1             # provide memory map
.set FLAGS,    ALIGN | MEMINFO  # this is the Multiboot 'flag' field
.set MAGIC,    0x1BADB002       # 'magic number' lets bootloader find the header
.set CHECKSUM, -(MAGIC + FLAGS) # checksum of above, to prove we are multiboot

# Declare a header as in the Multiboot Standard.
.section .multiboot
.align 4
.long MAGIC
.long FLAGS
.long CHECKSUM

# Reserve a stack for the initial thread.
.section .bss
.align 16
stack_bottom:
.skip 16384 # 16 KiB
stack_top:

# The kernel entry point.
.section .text
.global _start
.type _start, @function
_start:
	movl $stack_top, %esp

	# Call the global constructors.
	call _init

	# Transfer control to the main kernel.
	call kernel_main

	# Hang if kernel_main unexpectedly returns.
	cli
1:	hlt
	jmp 1b
.size _start, . - _start

```


#### kernel/.gitignore

```
*.d
*.kernel
*.o

```


### libc and libk

#### libc/include/string.h

```
#ifndef _STRING_H
#define _STRING_H 1

#include <sys/cdefs.h>

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

int memcmp(const void*, const void*, size_t);
void* memcpy(void* __restrict, const void* __restrict, size_t);
void* memmove(void*, const void*, size_t);
void* memset(void*, int, size_t);
size_t strlen(const char*);

#ifdef __cplusplus
}
#endif

#endif

```


#### libc/include/stdio.h

```
#ifndef _STDIO_H
#define _STDIO_H 1

#include <sys/cdefs.h>

#define EOF (-1)

#ifdef __cplusplus
extern "C" {
#endif

int printf(const char* __restrict, ...);
int putchar(int);
int puts(const char*);

#ifdef __cplusplus
}
#endif

#endif

```


#### libc/include/sys/cdefs.h

```
#ifndef _SYS_CDEFS_H
#define _SYS_CDEFS_H 1

#define __myos_libc 1

#endif

```


#### libc/include/stdlib.h

```
#ifndef _STDLIB_H
#define _STDLIB_H 1

#include <sys/cdefs.h>

#ifdef __cplusplus
extern "C" {
#endif

__attribute__((__noreturn__))
void abort(void);

#ifdef __cplusplus
}
#endif

#endif

```


#### libc/Makefile

```
DEFAULT_HOST!=../default-host.sh
HOST?=DEFAULT_HOST
HOSTARCH!=../target-triplet-to-arch.sh $(HOST)

CFLAGS?=-O2 -g
CPPFLAGS?=
LDFLAGS?=
LIBS?=

DESTDIR?=
PREFIX?=/usr/local
EXEC_PREFIX?=$(PREFIX)
INCLUDEDIR?=$(PREFIX)/include
LIBDIR?=$(EXEC_PREFIX)/lib

CFLAGS:=$(CFLAGS) -ffreestanding -Wall -Wextra
CPPFLAGS:=$(CPPFLAGS) -D__is_libc -Iinclude
LIBK_CFLAGS:=$(CFLAGS)
LIBK_CPPFLAGS:=$(CPPFLAGS) -D__is_libk

ARCHDIR=arch/$(HOSTARCH)

include $(ARCHDIR)/make.config

CFLAGS:=$(CFLAGS) $(ARCH_CFLAGS)
CPPFLAGS:=$(CPPFLAGS) $(ARCH_CPPFLAGS)
LIBK_CFLAGS:=$(LIBK_CFLAGS) $(KERNEL_ARCH_CFLAGS)
LIBK_CPPFLAGS:=$(LIBK_CPPFLAGS) $(KERNEL_ARCH_CPPFLAGS)

FREEOBJS=\
$(ARCH_FREEOBJS) \
stdio/printf.o \
stdio/putchar.o \
stdio/puts.o \
stdlib/abort.o \
string/memcmp.o \
string/memcpy.o \
string/memmove.o \
string/memset.o \
string/strlen.o \

HOSTEDOBJS=\
$(ARCH_HOSTEDOBJS) \

OBJS=\
$(FREEOBJS) \
$(HOSTEDOBJS) \

LIBK_OBJS=$(FREEOBJS:.o=.libk.o)

#BINARIES=libc.a libk.a # Not ready for libc yet.
BINARIES=libk.a

.PHONY: all clean install install-headers install-libs
.SUFFIXES: .o .libk.o .c .S

all: $(BINARIES)

libc.a: $(OBJS)
	$(AR) rcs $@ $(OBJS)

libk.a: $(LIBK_OBJS)
	$(AR) rcs $@ $(LIBK_OBJS)

.c.o:
	$(CC) -MD -c $< -o $@ -std=gnu11 $(CFLAGS) $(CPPFLAGS)

.S.o:
	$(CC) -MD -c $< -o $@ $(CFLAGS) $(CPPFLAGS)

.c.libk.o:
	$(CC) -MD -c $< -o $@ -std=gnu11 $(LIBK_CFLAGS) $(LIBK_CPPFLAGS)

.S.libk.o:
	$(CC) -MD -c $< -o $@ $(LIBK_CFLAGS) $(LIBK_CPPFLAGS)

clean:
	rm -f $(BINARIES) *.a
	rm -f $(OBJS) $(LIBK_OBJS) *.o */*.o */*/*.o
	rm -f $(OBJS:.o=.d) $(LIBK_OBJS:.o=.d) *.d */*.d */*/*.d

install: install-headers install-libs

install-headers:
	mkdir -p $(DESTDIR)$(INCLUDEDIR)
	cp -R --preserve=timestamps include/. $(DESTDIR)$(INCLUDEDIR)/.

install-libs: $(BINARIES)
	mkdir -p $(DESTDIR)$(LIBDIR)
	cp $(BINARIES) $(DESTDIR)$(LIBDIR)

-include $(OBJS:.o=.d)
-include $(LIBK_OBJS:.o=.d)

```


#### libc/stdlib/abort.c

```
#include <stdio.h>
#include <stdlib.h>

__attribute__((__noreturn__))
void abort(void) {
#if defined(__is_libk)
	// TODO: Add proper kernel panic.
	printf("kernel: panic: abort()\n");
        asm volatile("hlt");
#else
	// TODO: Abnormally terminate the process as if by SIGABRT.
	printf("abort()\n");
#endif
	while (1) { }
	__builtin_unreachable();
}

```


#### libc/string/memmove.c

```
#include <string.h>

void* memmove(void* dstptr, const void* srcptr, size_t size) {
	unsigned char* dst = (unsigned char*) dstptr;
	const unsigned char* src = (const unsigned char*) srcptr;
	if (dst < src) {
		for (size_t i = 0; i < size; i++)
			dst[i] = src[i];
	} else {
		for (size_t i = size; i != 0; i--)
			dst[i-1] = src[i-1];
	}
	return dstptr;
}

```


#### libc/string/strlen.c

```
#include <string.h>

size_t strlen(const char* str) {
	size_t len = 0;
	while (str[len])
		len++;
	return len;
}

```


#### libc/string/memcmp.c

```
#include <string.h>

int memcmp(const void* aptr, const void* bptr, size_t size) {
	const unsigned char* a = (const unsigned char*) aptr;
	const unsigned char* b = (const unsigned char*) bptr;
	for (size_t i = 0; i < size; i++) {
		if (a[i] < b[i])
			return -1;
		else if (b[i] < a[i])
			return 1;
	}
	return 0;
}

```


#### libc/string/memset.c

```
#include <string.h>

void* memset(void* bufptr, int value, size_t size) {
	unsigned char* buf = (unsigned char*) bufptr;
	for (size_t i = 0; i < size; i++)
		buf[i] = (unsigned char) value;
	return bufptr;
}

```


#### libc/string/memcpy.c

```
#include <string.h>

void* memcpy(void* restrict dstptr, const void* restrict srcptr, size_t size) {
	unsigned char* dst = (unsigned char*) dstptr;
	const unsigned char* src = (const unsigned char*) srcptr;
	for (size_t i = 0; i < size; i++)
		dst[i] = src[i];
	return dstptr;
}

```


#### libc/stdio/puts.c

```
#include <stdio.h>

int puts(const char* string) {
	return printf("%s\n", string);
}

```


#### libc/stdio/putchar.c

```
#include <stdio.h>

#if defined(__is_libk)
#include <kernel/tty.h>
#endif

int putchar(int ic) {
#if defined(__is_libk)
	char c = (char) ic;
	terminal_write(&c, sizeof(c));
#else
	// TODO: Implement stdio and the write system call.
#endif
	return ic;
}

```


#### libc/stdio/printf.c

```
#include <limits.h>
#include <stdbool.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

static bool print(const char* data, size_t length) {
	const unsigned char* bytes = (const unsigned char*) data;
	for (size_t i = 0; i < length; i++)
		if (putchar(bytes[i]) == EOF)
			return false;
	return true;
}

int printf(const char* restrict format, ...) {
	va_list parameters;
	va_start(parameters, format);

	int written = 0;

	while (*format != '\0') {
		size_t maxrem = INT_MAX - written;

		if (format[0] != '%' || format[1] == '%') {
			if (format[0] == '%')
				format++;
			size_t amount = 1;
			while (format[amount] && format[amount] != '%')
				amount++;
			if (maxrem < amount) {
				// TODO: Set errno to EOVERFLOW.
				return -1;
			}
			if (!print(format, amount))
				return -1;
			format += amount;
			written += amount;
			continue;
		}

		const char* format_begun_at = format++;

		if (*format == 'c') {
			format++;
			char c = (char) va_arg(parameters, int /* char promotes to int */);
			if (!maxrem) {
				// TODO: Set errno to EOVERFLOW.
				return -1;
			}
			if (!print(&c, sizeof(c)))
				return -1;
			written++;
		} else if (*format == 's') {
			format++;
			const char* str = va_arg(parameters, const char*);
			size_t len = strlen(str);
			if (maxrem < len) {
				// TODO: Set errno to EOVERFLOW.
				return -1;
			}
			if (!print(str, len))
				return -1;
			written += len;
		} else {
			format = format_begun_at;
			size_t len = strlen(format);
			if (maxrem < len) {
				// TODO: Set errno to EOVERFLOW.
				return -1;
			}
			if (!print(format, len))
				return -1;
			written += len;
			format += len;
		}
	}

	va_end(parameters);
	return written;
}

```


#### libc/arch/i386/make.config

```
ARCH_CFLAGS=
ARCH_CPPFLAGS=
KERNEL_ARCH_CFLAGS=
KERNEL_ARCH_CPPFLAGS=

ARCH_FREEOBJS=\

ARCH_HOSTEDOBJS=\

```


#### libc/.gitignore

```
*.a
*.d
*.o

```


### Miscellaneous

These files go into the root source directory.

#### build.sh

```
#!/bin/sh
set -e
. ./headers.sh

for PROJECT in $PROJECTS; do
  (cd $PROJECT && DESTDIR="$SYSROOT" $MAKE install)
done

```


You should make this executable script executable by running:

#### clean.sh

```
#!/bin/sh
set -e
. ./config.sh

for PROJECT in $PROJECTS; do
  (cd $PROJECT && $MAKE clean)
done

rm -rf sysroot
rm -rf isodir
rm -rf myos.iso

```


You should make this executable script executable by running:

#### config.sh

```
SYSTEM_HEADER_PROJECTS="libc kernel"
PROJECTS="libc kernel"

export MAKE=${MAKE:-make}
export HOST=${HOST:-$(./default-host.sh)}

export AR=${HOST}-ar
export AS=${HOST}-as
export CC=${HOST}-gcc

export PREFIX=/usr
export EXEC_PREFIX=$PREFIX
export BOOTDIR=/boot
export LIBDIR=$EXEC_PREFIX/lib
export INCLUDEDIR=$PREFIX/include

export CFLAGS='-O2 -g'
export CPPFLAGS=''

# Configure the cross-compiler to use the desired system root.
export SYSROOT="$(pwd)/sysroot"
export CC="$CC --sysroot=$SYSROOT"

# Work around that the -elf gcc targets doesn't have a system include directory
# because it was configured with --without-headers rather than --with-sysroot.
if echo "$HOST" | grep -Eq -- '-elf($|-)'; then
  export CC="$CC -isystem=$INCLUDEDIR"
fi

```


#### default-host.sh

You should make this executable script executable by running:

```
#!/bin/sh
set -e
. ./config.sh

mkdir -p "$SYSROOT"

for PROJECT in $SYSTEM_HEADER_PROJECTS; do
  (cd $PROJECT && DESTDIR="$SYSROOT" $MAKE install-headers)
done

```


You should make this executable script executable by running:

#### iso.sh

```
#!/bin/sh
set -e
. ./build.sh

mkdir -p isodir
mkdir -p isodir/boot
mkdir -p isodir/boot/grub

cp sysroot/boot/myos.kernel isodir/boot/myos.kernel
cat > isodir/boot/grub/grub.cfg << EOF
menuentry "myos" {
	multiboot /boot/myos.kernel
}
EOF
grub-mkrescue -o myos.iso isodir

```


You should make this executable script executable by running:

#### qemu.sh

```
#!/bin/sh
set -e
. ./iso.sh

qemu-system-$(./target-triplet-to-arch.sh $HOST) -cdrom myos.iso

```


You should make this executable script executable by running:

#### target-triplet-to-arch.sh

```
#!/bin/sh
if echo "$1" | grep -Eq 'i[[:digit:]]86-'; then
  echo i386
else
  echo "$1" | grep -Eo '^[[:alnum:]_]*'
fi

```


You should make this executable script executable by running:

```
chmod +x target-triplet-to-arch.sh

```


#### .gitignore

```
*.iso
isodir
sysroot

```


Cross-Compiling the Operating System
------------------------------------

The system is cross-compiled in the same manner as [Bare Bones](https://wiki.osdev.org/Bare_Bones "Bare Bones"), though with the complexity of having a system root with the final system and using a libk. In this example, we elected to use shell scripts to to the top-level build process, though you could possibly also use a makefile for that or a wholly different build system. Though, assuming this setup works for you, you can clean the source tree by invoking:

You can install all the system headers into the system root without relying on the compiler at all, which will be useful later on when switching to a [Hosted GCC Cross-Compiler](https://wiki.osdev.org/Hosted_GCC_Cross-Compiler "Hosted GCC Cross-Compiler"), by invoking:

You can build a bootable cdrom image of the operating system by invoking:

It's probably a good idea to create a quick _build-and-then-launch_ short-cut like used in this example to run the system in your favorite emulator quickly:

Troubleshooting
---------------

If you receive odd errors during the build, you may have made a mistake during manual copying, perhaps missed a file, forgot to make a file executable, or bugs in the highlighting software we use cause unintended whitespace to appear. Perform a git repository clone as described above, and use that code instead, or compare the two directory trees with the diff(1) diff command line utility. If you made personal changes to the code, those may be at fault.

Moving Forward
--------------

You should adapt this template to your needs. There's a number of things you should consider doing now:

### Renaming MyOS to YourOS

Certainly you wish to name your operating system after your favorite flower, hometown, boolean value, or whatever marketing told you. Do a search and replace that replaces myos with whatever you wish to call it. Keep in mind that the name is deliberately lower-case in a few places for technical reasons.

### Improving the Build System

_Main article:_ [Hard Build System](https://wiki.osdev.org/Hard_Build_System "Hard Build System")

It is probably worth improving the build system. For instance, it could be useful if build.sh accepted command-line options, or perhaps if it used make's important \-j option for concurrent builds.

It's worth considering how contributors will build your operating system. It's an easy trap to fall into thinking you can make super script that does everything. This will end up complex and insufficiently flexible; or it will be flexible and even more complex. It's better to document what the user should do to prepare a cross toolchain and what prerequisite programs to install. This tutorial shows an example hard build system that merely builds the operating system. You can complete it by documenting how to build a cross-compiler and how to use it.

### Stack Smash Protector

_Main article:_ [Stack Smashing Protector](https://wiki.osdev.org/Stack_Smashing_Protector "Stack Smashing Protector")

Early is not too soon to think about security and robustness. You can take advantage of the optional stack smash protector offered by modern compilers that detect stack buffer overruns rather than behaving unexpectedly (or nothing happening, if unlucky).

### Going Further

_Main article:_ [Going Further on x86](https://wiki.osdev.org/Going_Further_on_x86 "Going Further on x86")

This guide is meant as an overview of what to do, so you have a kernel ready for more features, without actually redesigning it radically when adding them.

### User-Space

A later tutorial in this series will extend this template with a proper user-space and an [OS Specific Toolchain](https://wiki.osdev.org/OS_Specific_Toolchain "OS Specific Toolchain") that fully utilizes the system root.

Forum Posts
-----------

*   [A link error found & fixed](http://forum.osdev.org/viewtopic.php?t=36584 "topic:36584")