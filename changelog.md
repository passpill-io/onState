**v0.7.4**
* Fix bug on nextTick

**v0.7.3**
* Use setImmediate to update the state at next tick for react-native

**v0.7.2**
* Make sure not use windows when we are not in a browser environment

**v0.7.1**
* Array methods now work ok on updated nodes

**v0.7.0**
* Updated nodes are now returning the right keys on enumeration

**v0.6.0**
* Refactors root node logic to keep child references

**v0.5.1**
* Fixes errors when trying to update the root node more than once
* Root node now keeps emiting state events after multiple updates

**v0.5.0**
* Rebuilds event system.
* All the path until the change is rebuilt now.
* State changes happen faster, on tick or on message.

**v0.4.0**
* Event listeners are conserved on state changes
* Changes in detached nodes are not emiting events anymore, a warning is shown in this case.
* Emit now returns the last non-undefined return value from the callbacks.

**v0.3.0**
* Custom events handled ok
* Adds off method
* Adds warnings for adding wrong listeners to the nodes
* Fixes array splice throwing an error
* 100% testing coverage

**v0.2.0**
* Moves UMD adapter out of the source code
* Creates build system
* Adds travis CI
* Adds coveralls
* Third strategy
* Forbid adding previous nodes

**v0.1.0**
* Memory leaks handled
* Two strategies
* Added tests
* We have a change log
* Add unchanged node preservation

**v0.0.1**
Initial version, proof of concept