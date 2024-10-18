# Bare Bones - OSDev Wiki

| Difficulty level |
| ---------------- |
| #Beginner        |

* Kernel Designs: Models
* Kernel Designs: Monolithic KernelMicrokernelHybrid KernelExokernelNano/PicokernelCache KernelVirtualizing KernelMegalithic Kernel
* Kernel Designs: Other Concepts
* Kernel Designs: Modular KernelHigher Half Kernel64-bit Kernel


In this tutorial you will write a simple kernel for [32-bit x86](https://wiki.osdev.org/IA32_Architecture_Family "IA32 Architecture Family") and boot it. This is the first step in creating your own operating system. This tutorial serves as an example of how to create a minimal system, but not as an example of how to properly structure your project. These instructions are community reviewed and follow the current recommendations for good reasons. Beware of the many other tutorials available online as they do not follow modern advice and were written by the inexperienced.

You are about to begin development of a new operating system. Perhaps one day, your new operating system can be developed under itself. This is a process known as bootstrapping or going self-hosted. Today, you will simply set up a system that can compile your new operating system from an existing operating system. This process is known as [cross-compiling](https://wiki.osdev.org/Why_do_I_need_a_Cross_Compiler%3F "Why do I need a Cross Compiler?") and it is the first step in operating systems development.

This tutorial uses existing technology to get you started and straight into [kernel](https://wiki.osdev.org/Kernel "Kernel") development, rather than developing your own [programming language](https://wiki.osdev.org/Languages "Languages"), your own [compiler](https://wiki.osdev.org/Compiler "Compiler"), and your own [bootloader](https://wiki.osdev.org/Bootloader "Bootloader"). In this tutorial, you will use:

*   The [GNU Linker](https://wiki.osdev.org/LD "LD") from [Binutils](https://wiki.osdev.org/Binutils "Binutils") to link your [object files](https://wiki.osdev.org/Object_File "Object File") into the final kernel.
*   The [GNU Assembler](https://wiki.osdev.org/GAS "GAS") from [Binutils](https://wiki.osdev.org/Binutils "Binutils") (or optionally [NASM](https://wiki.osdev.org/NASM "NASM")) to [assemble instructions](https://wiki.osdev.org/Assembly "Assembly") into object files containing machine code.
*   The [GNU Compiler Collection](https://wiki.osdev.org/GCC "GCC") to compile your high level code into assembly.
*   The [C](https://wiki.osdev.org/C "C") programming language (or optionally [C++](https://wiki.osdev.org/C%2B%2B "C++")) to write the high level parts of your [kernel](https://wiki.osdev.org/Kernel "Kernel").
*   The [GRUB](https://wiki.osdev.org/GRUB "GRUB") bootloader to [bootload](https://wiki.osdev.org/Bootloader "Bootloader") your kernel using the [Multiboot](https://wiki.osdev.org/Multiboot "Multiboot") boot protocol that loads us into 32-bit protected mode with [paging](https://wiki.osdev.org/Paging "Paging") disabled.
*   The [ELF](https://wiki.osdev.org/ELF "ELF") as the [executable format](https://wiki.osdev.org/Executable_Formats "Executable Formats") that gives us control of where and how the kernel is loaded.

This article assumes you are using a Unix-like operating system such as Linux which supports operating systems development well. Windows users should be able to complete it from a [WSL](https://wiki.osdev.org/WSL "WSL"), [MinGW](https://wiki.osdev.org/MinGW "MinGW"), or [Cygwin](https://wiki.osdev.org/Cygwin "Cygwin") environment.

Succeeding at operating systems development requires becoming an expert, having patience, and reading all the instructions very carefully. You need to read everything in this article before proceeding. If you run into problems, you need to reread the article even more carefully and then do it thrice more for good measure. If you still have issues, the OSDev community is experienced and will gladly help at the [forums](http://forum.osdev.org/) or on [IRC](https://wiki.osdev.org/Chat "Chat").

Building a Cross-Compiler
-------------------------

_Main article: [GCC Cross-Compiler](https://wiki.osdev.org/GCC_Cross-Compiler "GCC Cross-Compiler"), [Why do I need a Cross Compiler?](https://wiki.osdev.org/Why_do_I_need_a_Cross_Compiler%3F "Why do I need a Cross Compiler?")_

The first thing you should do is set up a [GCC Cross-Compiler](https://wiki.osdev.org/GCC_Cross-Compiler "GCC Cross-Compiler") for **i686-elf**. You have not yet modified your compiler to know about the existence of your operating system, so you will use a generic target called i686-elf, which provides you with a toolchain targeting the System V ABI. This setting is well tested and understood by the osdev community and will allow you to easily set up a bootable kernel using GRUB and Multiboot. (Note that if you are already using an ELF platform, such as Linux, you may already have a GCC that produces ELF programs. This is not suitable for osdev work, as this compiler will produce programs for Linux, and your operating system is **not** Linux, no matter how similar it is. You will certainly run into trouble if you don't use a cross-compiler.)

You will _not_ be able to correctly compile your operating system without a cross-compiler.

You will _not_ be able to correctly complete this tutorial with a x86\_64-elf cross-compiler, as GRUB is only able to load 32-bit multiboot kernels. If this is your first operating system project, you should do a 32-bit kernel first. If you use a x86\_64 compiler instead and somehow bypass the later sanity check, you will end up with a kernel that GRUB doesn't know how to boot.

Overview
--------

By now, you should have set up your [cross-compiler](https://wiki.osdev.org/GCC_Cross-Compiler "GCC Cross-Compiler") for i686-elf (as described above). This tutorial provides a minimal solution for creating an operating system for x86. It doesn't serve as a recommend skeleton for project structure, but rather as an example of a minimal kernel. In this simple case, you just need three input files:

*   boot.s - kernel entry point that sets up the processor environment
*   kernel.c - your actual kernel routines
*   linker.ld - for linking the above files

Booting the Operating System
----------------------------

To start the operating system, an existing piece of software will be needed to load it. This is called the bootloader and in this tutorial you will be using [GRUB](https://wiki.osdev.org/GRUB "GRUB"). Writing your own bootloader is an advanced subject, but it is commonly done. We'll later configure the bootloader, but the operating system needs to handle when the bootloader passes control to it. The kernel is passed a very minimal environment, in which the stack is not set up yet, virtual memory is not yet enabled, hardware is not initialized, and so on.

The first task you will deal with is how the bootloader starts the kernel. OSDevers are lucky because there exists a Multiboot Standard, which describes an easy interface between the bootloader and the operating system kernel. It works by putting a few magic values in some global variables (known as a multiboot header), which is searched for by the bootloader. When it sees these values, it recognizes the kernel as multiboot compatible and it knows how to load us, and it can even forward us important information such as memory maps, but you won't need that yet.

Since there is no stack yet and you need to make sure the global variables are set correctly, you will do this in assembly.

### Bootstrap Assembly

_Alternatively, you can use [NASM](https://wiki.osdev.org/Bare_Bones_with_NASM "Bare Bones with NASM") as your assembler._

You will now create a file called boot.s and discuss its contents. In this example, you are using the GNU assembler, which is part of the cross-compiler toolchain you built earlier. This assembler integrates very well with the rest of the GNU toolchain.

The very most important piece to create is the multiboot header, as it must be very early in the kernel binary, or the bootloader will fail to recognize us.

```
/* Declare constants for the multiboot header. */
.set ALIGN,    1<<0             /* align loaded modules on page boundaries */
.set MEMINFO,  1<<1             /* provide memory map */
.set FLAGS,    ALIGN | MEMINFO  /* this is the Multiboot 'flag' field */
.set MAGIC,    0x1BADB002       /* 'magic number' lets bootloader find the header */
.set CHECKSUM, -(MAGIC + FLAGS) /* checksum of above, to prove we are multiboot */

/* 
Declare a multiboot header that marks the program as a kernel. These are magic
values that are documented in the multiboot standard. The bootloader will
search for this signature in the first 8 KiB of the kernel file, aligned at a
32-bit boundary. The signature is in its own section so the header can be
forced to be within the first 8 KiB of the kernel file.
*/
.section .multiboot
.align 4
.long MAGIC
.long FLAGS
.long CHECKSUM

/*
The multiboot standard does not define the value of the stack pointer register
(esp) and it is up to the kernel to provide a stack. This allocates room for a
small stack by creating a symbol at the bottom of it, then allocating 16384
bytes for it, and finally creating a symbol at the top. The stack grows
downwards on x86. The stack is in its own section so it can be marked nobits,
which means the kernel file is smaller because it does not contain an
uninitialized stack. The stack on x86 must be 16-byte aligned according to the
System V ABI standard and de-facto extensions. The compiler will assume the
stack is properly aligned and failure to align the stack will result in
undefined behavior.
*/
.section .bss
.align 16
stack_bottom:
.skip 16384 # 16 KiB
stack_top:

/*
The linker script specifies _start as the entry point to the kernel and the
bootloader will jump to this position once the kernel has been loaded. It
doesn't make sense to return from this function as the bootloader is gone.
*/
.section .text
.global _start
.type _start, @function
_start:
	/*
	The bootloader has loaded us into 32-bit protected mode on a x86
	machine. Interrupts are disabled. Paging is disabled. The processor
	state is as defined in the multiboot standard. The kernel has full
	control of the CPU. The kernel can only make use of hardware features
	and any code it provides as part of itself. There's no printf
	function, unless the kernel provides its own <stdio.h> header and a
	printf implementation. There are no security restrictions, no
	safeguards, no debugging mechanisms, only what the kernel provides
	itself. It has absolute and complete power over the
	machine.
	*/

	/*
	To set up a stack, we set the esp register to point to the top of the
	stack (as it grows downwards on x86 systems). This is necessarily done
	in assembly as languages such as C cannot function without a stack.
	*/
	mov $stack_top, %esp

	/*
	This is a good place to initialize crucial processor state before the
	high-level kernel is entered. It's best to minimize the early
	environment where crucial features are offline. Note that the
	processor is not fully initialized yet: Features such as floating
	point instructions and instruction set extensions are not initialized
	yet. The GDT should be loaded here. Paging should be enabled here.
	C++ features such as global constructors and exceptions will require
	runtime support to work as well.
	*/

	/*
	Enter the high-level kernel. The ABI requires the stack is 16-byte
	aligned at the time of the call instruction (which afterwards pushes
	the return pointer of size 4 bytes). The stack was originally 16-byte
	aligned above and we've pushed a multiple of 16 bytes to the
	stack since (pushed 0 bytes so far), so the alignment has thus been
	preserved and the call is well defined.
	*/
	call kernel_main

	/*
	If the system has nothing more to do, put the computer into an
	infinite loop. To do that:
	1) Disable interrupts with cli (clear interrupt enable in eflags).
	   They are already disabled by the bootloader, so this is not needed.
	   Mind that you might later enable interrupts and return from
	   kernel_main (which is sort of nonsensical to do).
	2) Wait for the next interrupt to arrive with hlt (halt instruction).
	   Since they are disabled, this will lock up the computer.
	3) Jump to the hlt instruction if it ever wakes up due to a
	   non-maskable interrupt occurring or due to system management mode.
	*/
	cli
1:	hlt
	jmp 1b

/*
Set the size of the _start symbol to the current location '.' minus its start.
This is useful when debugging or when you implement call tracing.
*/
.size _start, . - _start

```


You can then assemble boot.s using:

```
i686-elf-as boot.s -o boot.o

```


Implementing the Kernel
-----------------------

So far you have written the bootstrap assembly stub that sets up the processor such that high level languages such as C can be used. It is also possible to use other languages such as C++.

### Freestanding and Hosted Environments

If you have done C or C++ programming in user-space, you have used a so-called Hosted Environment. Hosted means that there is a C standard library and other useful runtime features. Alternatively, there is the Freestanding version, which is what you are using here. Freestanding means that there is no C standard library, only what you provide yourself. However, some header files are actually not part of the C standard library, but rather the compiler. These remain available even in freestanding C source code. In this case you use <stdbool.h> to get the bool datatype, <stddef.h> to get size\_t and NULL, and <stdint.h> to get the intx\_t and uintx\_t datatypes which are invaluable for operating systems development, where you need to make sure that the variable is of an exact size (if you used a short instead of uint16\_t and the size of short changed, your VGA driver here would break!). Additionally you can access the <float.h>, <iso646.h>, <limits.h>, and <stdarg.h> headers, as they are also freestanding. GCC actually ships a few more headers, but these are special purpose.

### Writing a kernel in C

The following shows how to create a simple kernel in C. This kernel uses the VGA text mode buffer (located at `0xB8000`) as the output device. It sets up a simple driver that remembers the location of the next character in this buffer and provides a primitive for adding a new character. Notably, there is no support for line breaks ('\\n') (and writing that character will show some VGA-specific character instead) and no support for scrolling when the screen is filled up. Adding this will be your first task. Please take a few moments to understand the code.

**IMPORTANT NOTE**: the VGA text mode (as well as the BIOS) is deprecated on newer machines, and UEFI only supports pixel buffers. For forward compatibility you might want to start with that. Ask [GRUB](https://wiki.osdev.org/GRUB "GRUB") to set up a framebuffer using appropriate Multiboot flags or call [VESA VBE](https://wiki.osdev.org/Vesa "Vesa") yourself. Unlike VGA text mode, a framebuffer has pixels, so you have to draw each glyph yourself. This means you'll need a different `terminal_putchar`, and you'll need a font (bitmap images for each character). All Linux distro ships [PC Screen Fonts](https://wiki.osdev.org/PC_Screen_Font "PC Screen Font") that you can use, and the wiki article has a simple putchar() example. Otherwise everything else described here still stands (you have to keep track of the cursor position, implement line breaks and scrolling etc.)

```
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/* Check if the compiler thinks you are targeting the wrong operating system. */
#if defined(__linux__)
#error "You are not using a cross-compiler, you will most certainly run into trouble"
#endif

/* This tutorial will only work for the 32-bit ix86 targets. */
#if !defined(__i386__)
#error "This tutorial needs to be compiled with a ix86-elf compiler"
#endif

/* Hardware text mode color constants. */
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

static inline uint8_t vga_entry_color(enum vga_color fg, enum vga_color bg) 
{
	return fg | bg << 4;
}

static inline uint16_t vga_entry(unsigned char uc, uint8_t color) 
{
	return (uint16_t) uc | (uint16_t) color << 8;
}

size_t strlen(const char* str) 
{
	size_t len = 0;
	while (str[len])
		len++;
	return len;
}

static const size_t VGA_WIDTH = 80;
static const size_t VGA_HEIGHT = 25;

size_t terminal_row;
size_t terminal_column;
uint8_t terminal_color;
uint16_t* terminal_buffer;

void terminal_initialize(void) 
{
	terminal_row = 0;
	terminal_column = 0;
	terminal_color = vga_entry_color(VGA_COLOR_LIGHT_GREY, VGA_COLOR_BLACK);
	terminal_buffer = (uint16_t*) 0xB8000;
	for (size_t y = 0; y < VGA_HEIGHT; y++) {
		for (size_t x = 0; x < VGA_WIDTH; x++) {
			const size_t index = y * VGA_WIDTH + x;
			terminal_buffer[index] = vga_entry(' ', terminal_color);
		}
	}
}

void terminal_setcolor(uint8_t color) 
{
	terminal_color = color;
}

void terminal_putentryat(char c, uint8_t color, size_t x, size_t y) 
{
	const size_t index = y * VGA_WIDTH + x;
	terminal_buffer[index] = vga_entry(c, color);
}

void terminal_putchar(char c) 
{
	terminal_putentryat(c, terminal_color, terminal_column, terminal_row);
	if (++terminal_column == VGA_WIDTH) {
		terminal_column = 0;
		if (++terminal_row == VGA_HEIGHT)
			terminal_row = 0;
	}
}

void terminal_write(const char* data, size_t size) 
{
	for (size_t i = 0; i < size; i++)
		terminal_putchar(data[i]);
}

void terminal_writestring(const char* data) 
{
	terminal_write(data, strlen(data));
}

void kernel_main(void) 
{
	/* Initialize terminal interface */
	terminal_initialize();

	/* Newline support is left as an exercise. */
	terminal_writestring("Hello, kernel World!\n");
}

```


Notice how in the code you wished to use the common C function strlen, but this function is part of the C standard library that you don't have available. Instead, you relied on the freestanding header <stddef.h> to provide size\_t and you simply declared your own implementation of strlen. You will have to do this for every function you wish to use (as the freestanding headers only provide macros and data types).

Compile using:

```
i686-elf-gcc -c kernel.c -o kernel.o -std=gnu99 -ffreestanding -O2 -Wall -Wextra

```


Note that the above code uses a few extensions and hence you build as the GNU version of C99.

### Writing a kernel in C++

Writing a kernel in [C++](https://wiki.osdev.org/C%2B%2B "C++") is easy. Note that not all features from the language is available. For instance, exception support requires special runtime support and so does memory allocation. To write a kernel in C++, simply adopt code above: Add an extern "C" declaration to the main method. Notice how the kernel\_main function has to be declared with C linkage, as otherwise the compiler would include type information in the assembly name (name mangling). This complicates calling the function from your above assembly stub and you therefore use C linkage, where the symbol name is the same as the name of the function (with no additional type information). Save the code as kernel.c++ (or what your favorite C++ filename extension is).

You can compile the file kernel.c++ using:

```
i686-elf-g++ -c kernel.c++ -o kernel.o -ffreestanding -O2 -Wall -Wextra -fno-exceptions -fno-rtti

```


Note that you must have also built a cross C++ compiler for this work.

Linking the Kernel
------------------

You can now assemble boot.s and compile kernel.c. This produces two object files that each contain part of the kernel. To create the full and final kernel you will have to link these object files into the final kernel program, usable by the bootloader. When developing user-space programs, your toolchain ships with default scripts for linking such programs. However, these are unsuitable for kernel development and you need to provide your own customized linker script. Save the following in linker.ld:

```
/* The bootloader will look at this image and start execution at the symbol
   designated as the entry point. */
ENTRY(_start)

/* Tell where the various sections of the object files will be put in the final
   kernel image. */
SECTIONS
{
	/* It used to be universally recommended to use 1M as a start offset,
	   as it was effectively guaranteed to be available under BIOS systems.
	   However, UEFI has made things more complicated, and experimental data
	   strongly suggests that 2M is a safer place to load. In 2016, a new
	   feature was introduced to the multiboot2 spec to inform bootloaders
	   that a kernel can be loaded anywhere within a range of addresses and
	   will be able to relocate itself to run from such a loader-selected
	   address, in order to give the loader freedom in selecting a span of
	   memory which is verified to be available by the firmware, in order to
	   work around this issue. This does not use that feature, so 2M was
	   chosen as a safer option than the traditional 1M. */
	. = 2M;

	/* First put the multiboot header, as it is required to be put very early
	   in the image or the bootloader won't recognize the file format.
	   Next we'll put the .text section. */
	.text BLOCK(4K) : ALIGN(4K)
	{
		*(.multiboot)
		*(.text)
	}

	/* Read-only data. */
	.rodata BLOCK(4K) : ALIGN(4K)
	{
		*(.rodata)
	}

	/* Read-write data (initialized) */
	.data BLOCK(4K) : ALIGN(4K)
	{
		*(.data)
	}

	/* Read-write data (uninitialized) and stack */
	.bss BLOCK(4K) : ALIGN(4K)
	{
		*(COMMON)
		*(.bss)
	}

	/* The compiler may produce other sections, by default it will put them in
	   a segment with the same name. Simply add stuff here as needed. */
}

```


With these components you can now actually build the final kernel. We use the compiler as the linker as it allows it greater control over the link process. Note that if your kernel is written in C++, you should use the C++ compiler instead.

You can then link your kernel using:

```
i686-elf-gcc -T linker.ld -o myos.bin -ffreestanding -O2 -nostdlib boot.o kernel.o -lgcc

```


Note: Some tutorials suggest linking with i686-elf-ld rather than the compiler, however this prevents the compiler from performing various tasks during linking.

The file myos.bin is now your kernel (all other files are no longer needed). Note that we are linking against [libgcc](https://wiki.osdev.org/Libgcc "Libgcc"), which implements various runtime routines that your cross-compiler depends on. Leaving it out will give you problems in the future. If you did not build and install [libgcc](https://wiki.osdev.org/Libgcc "Libgcc") as part of your cross-compiler, you should go back now and build a cross-compiler with [libgcc](https://wiki.osdev.org/Libgcc "Libgcc"). The compiler depends on this library and will use it regardless of whether you provide it or not.

Verifying Multiboot
-------------------

If you have [GRUB](https://wiki.osdev.org/GRUB "GRUB") installed, you can check whether a file has a valid [Multiboot](https://wiki.osdev.org/Multiboot "Multiboot") version 1 header, which is the case for your kernel. It's important that the Multiboot header is within the first 8 KiB of the actual program file at 4 byte alignment. This can potentially break later if you make a mistake in the boot assembly, the linker script, or anything else that might go wrong. If the header isn't valid, GRUB will give an error that it can't find a Multiboot header when you try to boot it. This code fragment will help you diagnose such cases:

```
grub-file --is-x86-multiboot myos.bin

```


grub-file is quiet but will exit 0 (successfully) if it is a valid multiboot kernel and exit 1 (unsuccessfully) otherwise. You can type echo $? in your shell immediately afterwards to see the exit status. You can add this grub-file check to your build scripts as a sanity test to catch the problem at compile time. Multiboot version 2 can be checked with the \--is-x86-multiboot2 option instead. If you invoke the grub-file command manually in a shell, it is convenient to wrap it in a conditional to easily see the status. This command should work now:

```
if grub-file --is-x86-multiboot myos.bin; then
  echo multiboot confirmed
else
  echo the file is not multiboot
fi

```


Booting the Kernel
------------------

In a few moments, you will see your kernel in action.

### Building a bootable cdrom image

You can easily create a bootable CD-ROM image containing the GRUB bootloader and your kernel using the program grub-mkrescue. You may need to install the GRUB utility programs and the program xorriso (version 0.5.6 or higher). First you should create a file called grub.cfg containing the contents:

```
menuentry "myos" {
	multiboot /boot/myos.bin
}

```


Note that the braces must be placed as shown here. You can now create a bootable image of your operating system by typing these commands:

```
mkdir -p isodir/boot/grub
cp myos.bin isodir/boot/myos.bin
cp grub.cfg isodir/boot/grub/grub.cfg
grub-mkrescue -o myos.iso isodir

```


Congratulations! You have now created a file called myos.iso that contains your Hello World operating system. If you don't have the program grub-mkrescue installed, now is a good time to install GRUB. It should already be installed on Linux systems. Windows users will likely want to use a Cygwin variant if no native grub-mkrescue program is available.

**Warning:** GNU GRUB, the bootloader used by grub-mkrescue, is licensed under the GNU General Public License. Your iso file contains copyrighted material under that license and redistributing it in violation of the GPL constitutes copyright infringement. The GPL requires you publish the source code corresponding to the bootloader. You need to get the exact source package corresponding to the GRUB package you have installed from your distribution, at the time grub-mkrescue is invoked (as distro packages are occasionally updated). You then need to publish that source code along with your ISO to satisfy the GPL. Alternative, you can build GRUB from source code yourself. Extract it somewhere, then build GRUB from it, and install it in a isolated prefix in your PATH to ensure its grub-mkrescue program is used to produce your iso. You can then publish the official GRUB tarball along with your OS release. You're not required to publish the source code of your OS at all, only the code for the bootloader that's inside the iso.

### Testing your operating system (QEMU)

Virtual Machines are very useful for development operating systems, as they allow you to quickly test your code and have access to the source code during the execution. Otherwise, you would be in for an endless cycle of reboots that would only annoy you. They start very quickly, especially combined with small operating systems such as yours.

In this tutorial, we will be using QEMU. You can also use other virtual machines if you please. Simply adding the ISO to the CD drive of an empty virtual machine will do the trick.

Install QEMU from your repositories, and then use the following command to start your new operating system.

```
qemu-system-i386 -cdrom myos.iso

```


This should start a new virtual machine containing only your ISO as a cdrom. If all goes well, you will be met with a menu provided by the bootloader. Simply select myos and if all goes well, you should see the happy words "Hello, Kernel World!" followed by some mysterious character.

Additionally, QEMU supports booting multiboot kernels directly without bootable medium:

```
qemu-system-i386 -kernel myos.bin

```


### Testing your operating system (Real Hardware)

The program grub-mkrescue is nice because it makes a bootable ISO that works on both real computers and virtual machines. You can then build an ISO and use it everywhere. To boot your kernel on your local computer you can install myos.bin to your /boot directory and configure your bootloader appropriately.

Or alternatively, you can burn it to an USB stick (erasing all data on it!). To do so, simply find out the name of the USB block device, in my case /dev/sdb but this may vary, and using the wrong block device (your harddisk, gasp!) may be disastrous. If you are using Linux and /dev/sdx is your block name, simply:

```
sudo dd if=myos.iso of=/dev/sdx && sync

```


Your operating system will then be installed on your USB stick. If you configure your BIOS to boot from USB first, you can insert the USB stick and your computer should start your operating system.

Alternatively, the .iso is a normal cdrom image. Simply burn it to a CD or DVD if you feel like wasting one of those on a few kilobytes large kernel.

Moving Forward
--------------

Now that you can run your new shiny operating system, congratulations! Of course, depending on how much this interests you, it may just be the beginning. Here's a few things to get going.

### Adding Support for Newlines to Terminal Driver

The current terminal driver does not handle newlines. The VGA text mode font stores another character at the location, since newlines are never meant to be actually rendered: they are logical entities. Rather, in terminal\_putchar check if c == '\\n' and increment terminal\_row and reset terminal\_column.

### Implementing Terminal Scrolling

In case the terminal is filled up, it will just go back to the top of the screen. This is unacceptable for normal use. Instead, it should move all rows up one row and discard the upper most, and leave a blank row at the bottom ready to be filled up with characters. Implement this.

### Rendering Colorful ASCII Art

Use the existing terminal driver to render some pretty stuff in all the glorious 16 colors you have available. Note that only 8 colors may be available for the background color, as the uppermost bit in the entries by default means something other than background color. You'll need a real VGA driver to fix this.

### Calling Global Constructors

_Main article:_ [Calling Global Constructors](https://wiki.osdev.org/Calling_Global_Constructors "Calling Global Constructors")

This tutorial showed a small example of how to create a minimal environment for C and C++ kernels. Unfortunately, you don't have everything set up yet. For instance, C++ with global objects will not have their constructors called because you never do it. The compiler uses a special mechanism for performing tasks at program initialization time through the crt\*.o objects, which may be valuable even for C programmers. If you combine the crt\*.o files correctly, you will create an \_init function that invokes all the program initialization tasks. Your boot.o object file can then invoke \_init before calling kernel\_main.

### Meaty Skeleton

_Main article:_ [Meaty Skeleton](https://wiki.osdev.org/Meaty_Skeleton "Meaty Skeleton")

This tutorial is meant as a minimal example to give impatient beginners a quick hello world operating system. It is deliberately minimal and doesn't show the best practices on how to organize your operating system. The Meaty Skeleton tutorial shows an example of how to organize a minimal operating system with a kernel, room for a standard library to grow, and prepared for a user-space to appear.

### Going Further

_Main article:_ [Going Further on x86](https://wiki.osdev.org/Going_Further_on_x86 "Going Further on x86")

This guide is meant as an overview of what to do, so you have a kernel ready for more features, without actually redesigning it radically when adding them.

### Bare Bones II

Make your operating system self-hosting and then complete Bare Bones under your own operating system while following all the instructions. This is a five star exercise and you may need a couple of years to solve it.

Frequently Asked Questions
--------------------------

Why the Multiboot header? Wouldn't a pure [ELF](https://wiki.osdev.org/ELF "ELF") file be loadable by GRUB anyway?

GRUB is capable of loading a variety of formats. However, in this tutorial we are creating a Multiboot compliant kernel that could be loaded by any other compliant bootloader. To achieve this, the multiboot header is mandatory.

Is the AOUT kludge required for my kernel?

The AOUT kludge is not necessary for kernels in ELF format: a multiboot-compliant loader will recognize an ELF executable as such and use the program header to load things in their proper place. You can provide an AOUT kludge with your ELF kernel, in which case the headers of the ELF file are ignored. With any other format, such as AOUT, COFF or PE kernels, the AOUT kludge it is required, however.

Can the Multiboot header be anywhere in the kernel file, or does it have to be in a specific offset?

The Multiboot header must be in the first 8kb of the kernel file and must be aligned to a 32-bit (4 byte) boundary for GRUB to find it. You can ensure that this is the case by putting the header in its own source code file and passing that as the first object file to LD.

Will GRUB wipe the BSS section before loading the kernel?

Yes. For ELF kernels, the .bss section is automatically identified and cleared (despite the Multiboot specification being a bit vague about it). For other formats, if you ask it politely to do so, that is if you use the 'address override' information from the Multiboot header (flag #16) and give a non-zero value to the bss\_end\_addr field. Note that using "address override" with an ELF kernel will disable the default behavior and do what is described by the "address override" header instead.

What is the state of registers/memory/etc. when GRUB calls my kernel?

GRUB is an implementation of the Multiboot specification. Anything not specified there is "undefined behavior", which should ring a bell (not only) with C/C++ programmers... Better check the Machine State section of Multiboot documentation, and assume nothing else.

I still get Error 13: Invalid or unsupported executable format from GRUB...

Chances are the Multiboot header is missing from the final executable, or it is not at the right location.

If you are using some other format than ELF (such as PE), you should specify the AOUT kludge in the Multiboot header. The grub-file program describe aboveand "objdump -h" should give you more hints about what is going on.

It may also happen if you use an ELF object file instead of an executable (e.g. you have an ELF file with unresolved symbols or unfixable relocations). Try to link your ELF file to a binary executable to get more accurate error messages.

A common problem when your kernel size increases, is that the Multiboot header does no longer appear at the start of the output binary. The common solutions is to put the Multiboot header in a separate section and make sure that section is first in the output binary, or to include the Multiboot header itself in the linker script.

I get Boot failed: Could not read from CD-ROM (code 0009) when trying to boot the iso image in QEMU

If your development system is booted from EFI it may be that you don't have the PC-BIOS version of the grub binaries installed anywhere. If you install them then grub-mkrescue will by default produce a hybrid ISO that will work in QEMU. On Ubuntu this can be achieved with: **apt-get install grub-pc-bin**.

See Also
--------

### Articles

*   [Books](https://wiki.osdev.org/Books "Books")
*   [Limine Bare Bones](https://wiki.osdev.org/Limine_Bare_Bones "Limine Bare Bones")
*   [BOOTBOOT](https://wiki.osdev.org/BOOTBOOT "BOOTBOOT")

### External Links

*   [Limine Boot Protocol Specification](https://github.com/limine-bootloader/limine/blob/trunk/PROTOCOL.md)
*   [Multiboot Specification](https://www.gnu.org/software/grub/manual/multiboot/multiboot.html)
*   [Multiboot2 Specification](https://www.gnu.org/software/grub/manual/multiboot2/multiboot.html)
*   [BOOTBOOT Specification](https://gitlab.com/bztsrc/bootboot/raw/master/bootboot_spec_1st_ed.pdf)
*   [The POSIX Standard](https://pubs.opengroup.org/onlinepubs/9699919799/)