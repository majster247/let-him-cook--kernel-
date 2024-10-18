#include <iostream>

using namespace std;

class dataTypes
{
    public:
    string dataName;
    int type;
    size_t size;
    int dataTable();
    void initializeDataType(string dataName, int type, size_t size);
};


int kernel_entry(){
    int dataTable = dataTable();

}