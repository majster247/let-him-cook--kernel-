# Inter-Process Communication

This part will explain how to allow two processes to safely communicate with each other, providing two example implementations.

Below the list of chapters:

- [Overview](OSDEV_PDF/Book/07_IPC/01_Overview.md) A brief introduction to what is the Inter-Process communication, and what are the types that will be covered in this part.
- [Shared_Memory](02_Shared_Memory.md) is the easiest way for two processes to communicate each other, by mapping the same memory into both addresses spaces. This chapter will look at an example implementation.
- [Message Passing](03_Message_Passing.md) will cover message passing, which moves packets of information between two processes.
