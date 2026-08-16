# TT-Metal host-side breakpoints for the Quasar SingleDmL1Write flow.
# Run from the TT-Metal repository root:
#
#   gdb -x /path/to/tt-sim/examples/gdb/quasar-host-device.gdb \
#     --args ./build-debug/test/tt_metal/unit_tests_legacy \
#     --gtest_filter=QuasarMeshDeviceSingleCardFixture.SingleDmL1Write
#
# These breakpoints inspect the x86-64 host. They do not single-step the
# simulated RISC-V kernel.

set pagination off
set print pretty on
set print object on
set breakpoint pending on

catch throw

# ProgramSpec creation, run arguments, enqueue.
break tests/tt_metal/tt_metal/test_single_dm_l1_write.cpp:80
break tests/tt_metal/tt_metal/test_single_dm_l1_write.cpp:88
break tests/tt_metal/tt_metal/test_single_dm_l1_write.cpp:93

# First-call per-node RTA and CRTA serialization.
break tt_metal/impl/metal2_host_api/program_run_args.cpp:704
break tt_metal/impl/metal2_host_api/program_run_args.cpp:742

# Kernel ELF selection and XIP/load-span packing.
break tt_metal/impl/kernels/kernel.cpp:984
break tt_metal/llrt/tt_memory.cpp:28
break tt_metal/llrt/tt_memory.cpp:48

# Packed program pages before transfer metadata vectors are moved.
break tt_metal/impl/program/program.cpp:2211

define tt-host-state
  echo \n--- TT host state ---\n
  bt 12
  info args
  info locals
end

document tt-host-state
Print a 12-frame host backtrace followed by arguments and local variables.
Use this at every boundary breakpoint before continuing.
end

echo Quasar host-to-device breakpoints loaded.\n
echo Run the program, then use tt-host-state at each stop.\n
