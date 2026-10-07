#import <Foundation/Foundation.h>
#import <objc/message.h>
#import <dlfcn.h>

// Roundtrip the parameter states that Shortcuts serializes when editing any field.
// No workflow is installed or executed, and no Apple user data is accessed.
int main(int argc, const char * argv[]) {
  @autoreleasepool {
    if (argc != 2) return 2;
    void * library = dlopen("/System/Library/PrivateFrameworks/WorkflowKit.framework/WorkflowKit", RTLD_NOW);
    Class cls = NSClassFromString(@"WFDictionaryParameterState");
    Class conditional = NSClassFromString(@"WFConditionalSubjectParameterState");
    if (!library || !cls || !conditional) { fprintf(stderr, "WorkflowKit unavailable\n"); return 2; }
    NSError * error = nil;
    NSData * data = [NSData dataWithContentsOfFile:[NSString stringWithUTF8String:argv[1]]];
    NSDictionary * workflow = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:&error] : nil;
    if (!workflow || error) return 2;
    int checked = 0;
    int conditions = 0;
    for (NSDictionary * action in workflow[@"WFWorkflowActions"]) {
      NSDictionary * parameters = action[@"WFWorkflowActionParameters"];
      if ([action[@"WFWorkflowActionIdentifier"] isEqual:@"is.workflow.actions.conditional"] &&
          [parameters[@"WFControlFlowMode"] isEqual:@0]) {
        id state = ((id (*)(id, SEL, id, id, id))objc_msgSend)([conditional alloc],
          NSSelectorFromString(@"initWithSerializedRepresentation:variableProvider:parameter:"), parameters[@"WFInput"], nil, nil);
        id output = ((id (*)(id, SEL))objc_msgSend)(state, NSSelectorFromString(@"serializedRepresentation"));
        if (!output || ![parameters[@"WFInput"] isEqual:output]) {
          fprintf(stderr, "Invalid conditional input: %s\n", [parameters[@"CustomOutputName"] UTF8String]);
          return 1;
        }
        conditions++;
      }
      for (NSString * key in @[@"WFItems", @"WFHTTPHeaders", @"WFFormValues"]) {
        NSDictionary * value = parameters[key];
        if (![value[@"WFSerializationType"] isEqual:@"WFDictionaryFieldValue"]) continue;
        @try {
          id state = ((id (*)(id, SEL, id, id, id))objc_msgSend)([cls alloc],
            NSSelectorFromString(@"initWithSerializedRepresentation:variableProvider:parameter:"), value, nil, nil);
          id output = ((id (*)(id, SEL))objc_msgSend)(state, NSSelectorFromString(@"serializedRepresentation"));
          if (!output || ![value isEqual:output]) {
            fprintf(stderr, "Roundtrip mismatch: %s / %s\n", [parameters[@"CustomOutputName"] UTF8String], [key UTF8String]);
            return 1;
          }
          checked++;
        } @catch (NSException * exception) {
          fprintf(stderr, "%s: %s\n", [exception.name UTF8String], [exception.reason UTF8String]);
          return 1;
        }
      }
    }
    if (checked < 3 || conditions != 7) return 2;
    printf("WorkflowKit: %d parameter states roundtripped\n", checked);
    printf("WorkflowKit: %d conditional inputs roundtripped\n", conditions);
  }
  return 0;
}
