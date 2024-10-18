
# Boot Sequence - OSDev Wiki
POST
----

When a computer is switched on or reset, it runs through a series of diagnostics called POST - **P**ower-**O**n **S**elf-**T**est. This sequence culminates in locating a bootable device, such as a Floppy disk, CD-ROM or a Hard disk in the order that the firmware is configured to.

Master Boot Record
------------------

The (legacy) BIOS checks bootable devices for a boot signature, a so called magic number. The boot signature is in a boot sector (sector number 0) and it contains the byte sequence 0x55, 0xAA at byte offsets 510 and 511 respectively. When the BIOS finds such a boot sector, it is loaded into memory at 0x0000:0x7c00 (segment 0, address 0x7c00). (However, some BIOS' load to 0x7c0:0x0000 (segment 0x07c0, offset 0), which resolves to the same physical address, but can be surprising. A good practice is to enforce CS:IP at the very start of your boot sector.)

Execution is then transferred to the freshly loaded boot record. On a floppy disk, all 512 bytes of the boot record (save the last two signature bytes) may contain executable code. On a hard drive, the [Master Boot Record](https://wiki.osdev.org/MBR_(x86) "MBR (x86)") (MBR) holds executable code at offset 0x0000 - 0x01bd, followed by table entries for the four [primary partitions](https://wiki.osdev.org/Partition_Table "Partition Table"), using sixteen bytes per entry (0x01be - 0x01fd), and the two-byte signature (0x01fe - 0x01ff).

Early Environment
-----------------

This early execution environment is highly implementation defined, meaning the implementation of your particular BIOS. _Never_ make any assumptions on the contents of registers: They might be initialized to 0, but they might contain a spurious value just as well. This includes the FLAGS register and the SP register, you may not have a valid stack either! The only thing that's certain, is that the DL register holds the drive code from where your boot code was loaded.

The CPU is currently in [Real Mode](https://wiki.osdev.org/Real_Mode "Real Mode"). (Unless you are running on one of those rare BIOS' which believe they're doing you a favor by activating [Protected Mode](https://wiki.osdev.org/Protected_Mode "Protected Mode") for you. Which means you not only have to write code for activating protected mode on any _other_ hardware, but should also add a test condition if it's already activated.)

Kernel
------

Finally, the bootloader loads the kernel into memory and passes control to it.

Loading
-------

Now we know _what_ we have to load, let's see _how_ we get it loaded.

If booting from hard drive, you have only 446 bytes available for your boot record. Looking at the list of things to do before your kernel image can run, you will agree that this is not much:

*   determine which partition to boot from (either by looking for the active partition, or by presenting the user with a selection of installed operating systems to chose from);
*   determine where your kernel image is located on the boot partition (either by interpreting the file system, or by loading the image from a fixed position);
*   load the kernel image into memory (requires basic disk I/O);
*   enable protected mode;
*   preparing the runtime environment for the kernel (e.g. setting up stack space);

You don't have to do things in this order, but all of this has to be done before you can call kmain().

To make things worse, GCC generates protected mode executables only, so the code for this early environment is one of the [Things You Cannot Do With C](https://wiki.osdev.org/C#Things_C_can't_do "C").

There are several approaches to this problem:

*   **Geek loading**: Squeeze everything from the above list into the boot record. This is next to impossible, and does not leave room for any special-case handling or useful error messages.
*   **One-stage loading**: Write a stub program for making the switch, and link that in front of your kernel image. Boot record loads kernel image (below the 1mb memory mark, because in real mode that's the upper memory limit!), jumps into the stub, stub makes the switch to Protected Mode and runtime preparations, jumps into kernel proper.
*   **Two-stage loading**: Write a _separate_ stub program which is loaded below the 1mb memory mark, and does everything from the above list.

### The Traditional Way

Traditionally, the MBR relocates itself to 0x0000:0x0600, determines the active partition from the partition table, loads the first sector of that partition (the "partition boot record") to 0x0000:0x7c00 (hence the previous relocation), and jumps to that address. This is called "chain loading". If you want your self-written boot record to be capable of dual-booting e.g. Windows, it should mimic this behaviour.

### Easy Way Out

Unless you really want to be [Rolling Your Own Bootloader](https://wiki.osdev.org/Rolling_Your_Own_Bootloader "Rolling Your Own Bootloader") (record / stubs) for the educational value, we recommend using readily available [bootloaders](https://wiki.osdev.org/Category:Bootloaders "Category:Bootloaders").

The most prominent one is [GRUB](https://wiki.osdev.org/GRUB "GRUB"), a two-stage bootloader that not only provides a boot menu with chainloading capability, but initializes the early environment to a well-defined state (including [Protected Mode](https://wiki.osdev.org/Protected_Mode "Protected Mode") and reading various interesting information from the BIOS), can load generic executables as kernel images (instead of requiring flat binaries like most other bootloaders), supports optional kernel modules, various file systems, and if ./configure'd correctly, [Diskless Booting](https://wiki.osdev.org/Diskless_Booting "Diskless Booting").

### Some methods

There are many possible variants to boot. Below is a list of methods but it is possible that there are even more methods:

*   You could take an unused partition and load the stage 2 "raw"
*   You could place the stage 2 between MBR and start of the first partition
*   You could (as Lilo did) write a kernel file, then use a tool to detect the sectors (or clusters). Then let stage 1 load the sectors from the list.
*   DOS and Windows do it this way: Create an empty filesystem (format it) and then place the kernel in the first file, and the shell in the second file in the empty rootdir. So the loader simply loads the first entry in the rootdir and then the second.
*   Old Linux was booting from floppy disk. The first sector ("boot") loaded the second stage in "raw" mode = without filesystem (The scond stage was"setup", in the sectors directly behind "boot") The second stage did setup the system (video mode, memory map, etc.) and then loaded the real kernel image (packed in tgz/ bz).
*   Several years ago here was a bootloader (called "nuni") which switched to pmode and loaded a file, all in one bootsector

See Also
--------

### External Links

*   [Jun 2008: How Computers Boot Up](http://duartes.org/gustavo/blog/post/how-computers-boot-up) by Gustavo Duarte.
*   [Jun 2008:The Kernel Boot Process](http://duartes.org/gustavo/blog/post/kernel-boot-process) by Gustavo Duarte.
*   IBM developerWorks' [Inside the Linux boot process](https://web.archive.org/web/20190402174801/https://developer.ibm.com/articles/l-linuxboot/) a very good, illustrated overview from BIOS to userspace.