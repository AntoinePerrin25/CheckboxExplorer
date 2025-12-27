#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    char message[] = "Hello, World!"; // [CB]:"Hello, World!";|"Goodbye, World!";
    printf("%s\n", message);

    return 0;
}