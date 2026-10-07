#import <Foundation/Foundation.h>
#import <objc/message.h>
#import <dlfcn.h>

@interface WorkCoreReminderFixtureSource : NSObject
@property(nonatomic, strong) id content;
@end
@implementation WorkCoreReminderFixtureSource
- (id)contentForVariableWithName:(NSString *)name { return [name isEqual:@"Fixture"] ? self.content : nil; }
@end

static BOOL verifyReminderLists(NSDictionary * value) {
  // Resolve the exact value-field encoding against in-memory content, not Apple data.
  NSMutableDictionary * fixtureValue = [value mutableCopy];
  NSMutableDictionary * inner = [value[@"Value"] mutableCopy];
  inner[@"attachmentsByRange"] = @{@"{0, 1}": @{@"Type": @"Variable", @"VariableName": @"Fixture"}};
  fixtureValue[@"Value"] = inner;
  for (NSNumber * count in @[@0, @1, @5]) {
    id collection = [NSClassFromString(@"WFContentCollection") new];
    NSMutableArray * expected = [NSMutableArray new];
    for (int i = 0; i < count.intValue; i++) {
      NSDictionary * row = @{@"title": [NSString stringWithFormat:@"Fixture %d", i], @"list": @"Test",
        @"notes": @"Quoted \"note\" & newline\nsecond", @"date": i % 2 ? @"2026-10-07" : @""};
      [expected addObject:row];
      ((void (*)(id, SEL, id))objc_msgSend)(collection, NSSelectorFromString(@"addObject:"), row);
    }
    WorkCoreReminderFixtureSource * source = [WorkCoreReminderFixtureSource new];
    source.content = collection;
    id parameter = ((id (*)(id, SEL, id))objc_msgSend)([NSClassFromString(@"WFTextInputParameter") alloc],
      NSSelectorFromString(@"initWithDefinition:"), @{@"Key": @"WFDictionaryValue", @"Class": @"WFTextInputParameter", @"Label": @"Value"});
    id context = ((id (*)(id, SEL, id, id, BOOL, id, id, NSInteger))objc_msgSend)([NSClassFromString(@"WFParameterStateProcessingContext") alloc],
      NSSelectorFromString(@"initWithVariableSource:parameter:isInputParameter:environment:contentAttributionTracker:widgetSizeClass:"),
      source, parameter, NO, nil, [NSClassFromString(@"WFContentAttributionTracker") new], 0);
    id state = ((id (*)(id, SEL, id, id, id))objc_msgSend)([NSClassFromString(@"WFVariableStringParameterState") alloc],
      NSSelectorFromString(@"initWithSerializedRepresentation:variableProvider:parameter:"), fixtureValue, nil, nil);
    id string = ((id (*)(id, SEL))objc_msgSend)(state, NSSelectorFromString(@"variableString"));
    __block BOOL done = NO;
    __block BOOL passed = NO;
    ((void (*)(id, SEL, id, id))objc_msgSend)(string, NSSelectorFromString(@"processIntoContentItemsWithContext:completionHandler:"), context, ^(id output, NSError * error) {
      ((void (*)(id, SEL, id, Class))objc_msgSend)(output, NSSelectorFromString(@"getObjectRepresentations:forClass:"), ^(NSArray * actual, NSError * failure) {
        passed = [expected isEqual:actual];
        done = YES;
      }, [NSDictionary class]);
    });
    NSDate * until = [NSDate dateWithTimeIntervalSinceNow:5];
    while (!done && [until timeIntervalSinceNow] > 0) [[NSRunLoop currentRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.01]];
    if (!passed) { fprintf(stderr, "Reminder content fixture failed: %d\n", count.intValue); return NO; }
    printf("WorkflowKit: %d reminder dictionaries preserved\n", count.intValue);
  }
  return YES;
}

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
    int values = 0;
    for (NSDictionary * action in workflow[@"WFWorkflowActions"]) {
      NSDictionary * parameters = action[@"WFWorkflowActionParameters"];
      if ([action[@"WFWorkflowActionIdentifier"] isEqual:@"is.workflow.actions.setvalueforkey"]) {
        Class textState = NSClassFromString(@"WFVariableStringParameterState");
        id state = ((id (*)(id, SEL, id, id, id))objc_msgSend)([textState alloc],
          NSSelectorFromString(@"initWithSerializedRepresentation:variableProvider:parameter:"), parameters[@"WFDictionaryValue"], nil, nil);
        id output = ((id (*)(id, SEL))objc_msgSend)(state, NSSelectorFromString(@"serializedRepresentation"));
        id string = ((id (*)(id, SEL))objc_msgSend)(state, NSSelectorFromString(@"variableString"));
        BOOL single = ((BOOL (*)(id, SEL))objc_msgSend)(string, NSSelectorFromString(@"representsSingleContentVariable"));
        if (!output || !single || ![parameters[@"WFDictionaryValue"] isEqual:output]) {
          fprintf(stderr, "Invalid dictionary value: %s\n", [parameters[@"CustomOutputName"] UTF8String]);
          return 1;
        }
        if (!verifyReminderLists(parameters[@"WFDictionaryValue"])) return 1;
        values++;
      }
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
    if (checked < 3 || conditions != 7 || values != 1) return 2;
    printf("WorkflowKit: %d parameter states roundtripped\n", checked);
    printf("WorkflowKit: %d conditional inputs roundtripped\n", conditions);
    printf("WorkflowKit: %d typed dictionary values roundtripped\n", values);
  }
  return 0;
}
